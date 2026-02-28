package com.scrumpoker.room;

import com.scrumpoker.room.dto.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;

@Service
public class RoomService {

    private static final Logger log = LoggerFactory.getLogger(RoomService.class);

    private final SimpMessagingTemplate messagingTemplate;
    private final ScheduledExecutorService scheduler;

    @Value("${reconnect.grace.period.ms:8000}")
    private long reconnectGracePeriodMs;

    @Value("${host.takeover.timeout.ms:60000}")
    private long hostTakeoverTimeoutMs;

    // roomId -> Room
    private final ConcurrentHashMap<String, Room> rooms = new ConcurrentHashMap<>();

    // sessionId -> roomId  (for disconnect handling)
    private final ConcurrentHashMap<String, String> sessionToRoom = new ConcurrentHashMap<>();

    // clientId -> ScheduledFuture (pending disconnect removals)
    private final ConcurrentHashMap<String, ScheduledFuture<?>> pendingRemovals = new ConcurrentHashMap<>();

    // roomId -> ScheduledFuture (host absent timer)
    private final ConcurrentHashMap<String, ScheduledFuture<?>> hostAbsentTimers = new ConcurrentHashMap<>();

    public RoomService(SimpMessagingTemplate messagingTemplate, ScheduledExecutorService scheduledExecutorService) {
        this.messagingTemplate = messagingTemplate;
        this.scheduler = scheduledExecutorService;
    }

    // ---- Join ---------------------------------------------------------------

    public synchronized void joinRoom(JoinRoomMessage msg, String sessionId) {
        String roomId = msg.getRoomId();
        String clientId = msg.getClientId();

        // Cancel pending removal for this clientId (reconnect case)
        cancelPendingRemoval(clientId);

        Room room = rooms.get(roomId);

        if (room == null) {
            // Create new room; first joiner is the host
            String cs = resolveCardSet(msg.getCardSet());
            room = new Room(roomId, sessionId, cs, msg.isSpecialEffects());
            rooms.put(roomId, room);
            log.info("Room {} created by session {}", roomId, sessionId);
        }

        // Check if this is a reconnecting user (same clientId)
        RoomUser existing = (clientId != null) ? room.findUserByClientId(clientId) : null;

        if (existing != null) {
            // Restore user with new sessionId
            String oldSessionId = existing.getId();
            sessionToRoom.remove(oldSessionId);

            // Replace user object keeping state (vote etc.)
            room.getUsers().remove(existing);
            RoomUser restored = new RoomUser(sessionId, clientId, existing.getName(), existing.isObserver());
            restored.setActualVote(existing.getActualVote());
            if (room.isRevealed()) {
                restored.setVote(existing.getActualVote());
            } else if (existing.getActualVote() != null) {
                restored.setVote("voted");
            }
            room.getUsers().add(restored);
            sessionToRoom.put(sessionId, roomId);
            room.getClientIdToSessionId().put(clientId, sessionId);

            // If this was the host, restore host role
            if (room.getCreatorId().equals(oldSessionId)) {
                room.setCreatorId(sessionId);
                cancelHostAbsentTimer(roomId);
            }

            log.info("User {} reconnected to room {} with new session {}", existing.getName(), roomId, sessionId);
        } else {
            // New user joining
            RoomUser user = new RoomUser(sessionId, clientId, msg.getUserName(), msg.isObserver());
            room.getUsers().add(user);
            sessionToRoom.put(sessionId, roomId);
            if (clientId != null) {
                room.getClientIdToSessionId().put(clientId, sessionId);
            }
            log.info("User {} joined room {}", msg.getUserName(), roomId);
        }

        broadcastRoomUpdate(room);

        // Auto-reveal check after join
        checkAutoReveal(room);
    }

    // ---- Vote ---------------------------------------------------------------

    public synchronized void castVote(VoteMessage msg, String sessionId) {
        Room room = rooms.get(msg.getRoomId());
        if (room == null || room.isRevealed()) return;

        RoomUser user = room.findUserBySessionId(sessionId);
        if (user == null || user.isObserver()) return;

        user.setActualVote(msg.getVote());
        user.setVote("voted"); // masked

        broadcastRoomUpdate(room);
        checkAutoReveal(room);
    }

    // ---- Reveal -------------------------------------------------------------

    public synchronized void revealCards(String roomId, String sessionId) {
        Room room = rooms.get(roomId);
        if (room == null) return;
        if (!room.getCreatorId().equals(sessionId)) return;

        room.setRevealed(true);
        // Unmask votes
        for (RoomUser u : room.getUsers()) {
            u.setVote(u.getActualVote());
        }

        broadcastRoomUpdate(room);
    }

    // ---- Reset --------------------------------------------------------------

    public synchronized void resetRound(String roomId, String sessionId) {
        Room room = rooms.get(roomId);
        if (room == null) return;
        if (!room.getCreatorId().equals(sessionId)) return;

        // Archive round if revealed
        if (room.isRevealed()) {
            List<Object> votes = room.getUsers().stream()
                    .filter(u -> !u.isObserver())
                    .map(RoomUser::getActualVote)
                    .collect(Collectors.toList());
            room.getRoundHistory().add(new Room.RoundRecord(room.getStoryTitle(), votes, Instant.now()));
        }

        room.setRevealed(false);
        room.setStoryTitle("");
        for (RoomUser u : room.getUsers()) {
            u.setVote(null);
            u.setActualVote(null);
        }

        broadcastRoomUpdate(room);
    }

    // ---- Story title --------------------------------------------------------

    public synchronized void setStoryTitle(String roomId, String storyTitle, String sessionId) {
        Room room = rooms.get(roomId);
        if (room == null) return;
        if (!room.getCreatorId().equals(sessionId)) return;

        room.setStoryTitle(storyTitle != null ? storyTitle : "");
        broadcastRoomUpdate(room);
    }

    // ---- Auto-reveal --------------------------------------------------------

    public synchronized void setAutoReveal(String roomId, boolean autoReveal, String sessionId) {
        Room room = rooms.get(roomId);
        if (room == null) return;
        if (!room.getCreatorId().equals(sessionId)) return;

        room.setAutoReveal(autoReveal);
        broadcastRoomUpdate(room);
        checkAutoReveal(room);
    }

    // ---- Remove participant -------------------------------------------------

    public synchronized void removeParticipant(String roomId, String participantId, String requestorSessionId) {
        Room room = rooms.get(roomId);
        if (room == null) return;
        if (!room.getCreatorId().equals(requestorSessionId)) return;

        RoomUser target = room.findUserBySessionId(participantId);
        if (target == null) return;

        room.getUsers().remove(target);
        sessionToRoom.remove(participantId);
        if (target.getClientId() != null) {
            room.getClientIdToSessionId().remove(target.getClientId());
        }

        // Notify the removed user
        messagingTemplate.convertAndSendToUser(participantId, "/queue/events",
                Map.of("type", "removed-from-room", "roomId", roomId));

        broadcastRoomUpdate(room);
    }

    // ---- Claim host ---------------------------------------------------------

    public synchronized void claimHost(String roomId, String sessionId) {
        Room room = rooms.get(roomId);
        if (room == null) return;

        RoomUser user = room.findUserBySessionId(sessionId);
        if (user == null) return;

        // Allow claim only if host is not present (no connected user with creatorId)
        boolean hostPresent = room.getUsers().stream()
                .anyMatch(u -> u.getId().equals(room.getCreatorId()) && u.isConnected());
        if (hostPresent) return;

        room.setCreatorId(sessionId);
        cancelHostAbsentTimer(roomId);
        broadcastRoomUpdate(room);
    }

    // ---- Leave --------------------------------------------------------------

    public synchronized void leaveRoom(String roomId, String sessionId) {
        Room room = rooms.get(roomId);
        if (room == null) return;

        RoomUser user = room.findUserBySessionId(sessionId);
        if (user == null) return;

        room.getUsers().remove(user);
        sessionToRoom.remove(sessionId);
        if (user.getClientId() != null) {
            room.getClientIdToSessionId().remove(user.getClientId());
        }

        handleHostDeparture(room, sessionId);
        broadcastRoomUpdate(room);
    }

    // ---- Disconnect (grace period) ------------------------------------------

    public synchronized void handleDisconnect(String sessionId) {
        String roomId = sessionToRoom.get(sessionId);
        if (roomId == null) return;

        Room room = rooms.get(roomId);
        if (room == null) return;

        RoomUser user = room.findUserBySessionId(sessionId);
        if (user == null) return;

        user.setConnected(false);
        String clientId = user.getClientId();

        log.info("Session {} disconnected from room {}, starting grace period", sessionId, roomId);

        // Schedule removal after grace period
        ScheduledFuture<?> future = scheduler.schedule(() -> {
            synchronized (RoomService.this) {
                pendingRemovals.remove(clientId);
                Room r = rooms.get(roomId);
                if (r == null) return;
                // Only remove if user hasn't reconnected (still same sessionId)
                RoomUser u = r.findUserBySessionId(sessionId);
                if (u != null) {
                    r.getUsers().remove(u);
                    sessionToRoom.remove(sessionId);
                    log.info("Removed user {} from room {} after grace period", u.getName(), roomId);
                    handleHostDeparture(r, sessionId);
                    broadcastRoomUpdate(r);
                }
            }
        }, reconnectGracePeriodMs, TimeUnit.MILLISECONDS);

        if (clientId != null) {
            pendingRemovals.put(clientId, future);
        }

        // Host absent timer
        if (room.getCreatorId().equals(sessionId)) {
            scheduleHostAbsentTimer(room);
        }
    }

    // ---- Internal helpers ---------------------------------------------------

    private void checkAutoReveal(Room room) {
        if (room.isAutoReveal() && !room.isRevealed() && !room.getUsers().isEmpty()) {
            // Need at least one voter
            boolean hasVoters = room.getUsers().stream().anyMatch(u -> !u.isObserver());
            if (hasVoters && room.allVotersVoted()) {
                room.setRevealed(true);
                for (RoomUser u : room.getUsers()) {
                    u.setVote(u.getActualVote());
                }
                broadcastRoomUpdate(room);
            }
        }
    }

    private void handleHostDeparture(Room room, String departedSessionId) {
        if (room.getCreatorId().equals(departedSessionId) && !room.getUsers().isEmpty()) {
            // Assign host to first non-observer if possible
            RoomUser newHost = room.getUsers().stream()
                    .filter(u -> !u.isObserver())
                    .findFirst()
                    .orElse(room.getUsers().get(0));
            room.setCreatorId(newHost.getId());
            log.info("Host transferred to {} in room {}", newHost.getName(), room.getId());
        }
    }

    private void scheduleHostAbsentTimer(Room room) {
        cancelHostAbsentTimer(room.getId());
        ScheduledFuture<?> future = scheduler.schedule(() -> {
            synchronized (RoomService.this) {
                Room r = rooms.get(room.getId());
                if (r == null) return;
                // Notify room that host is absent
                messagingTemplate.convertAndSend("/topic/room/" + r.getId(),
                        Map.of("type", "host-absent", "roomId", r.getId()));
            }
        }, hostTakeoverTimeoutMs, TimeUnit.MILLISECONDS);
        hostAbsentTimers.put(room.getId(), future);
    }

    private void cancelHostAbsentTimer(String roomId) {
        ScheduledFuture<?> timer = hostAbsentTimers.remove(roomId);
        if (timer != null) timer.cancel(false);
    }

    private void cancelPendingRemoval(String clientId) {
        if (clientId == null) return;
        ScheduledFuture<?> future = pendingRemovals.remove(clientId);
        if (future != null) future.cancel(false);
    }

    private String resolveCardSet(String requested) {
        if (requested != null && Room.CARD_SETS.containsKey(requested)) {
            return requested;
        }
        return "standard";
    }

    public void broadcastRoomUpdate(Room room) {
        RoomUpdateMessage update = buildUpdate(room);
        messagingTemplate.convertAndSend("/topic/room/" + room.getId(), update);
    }

    RoomUpdateMessage buildUpdate(Room room) {
        RoomUpdateMessage msg = new RoomUpdateMessage();
        msg.setRoomId(room.getId());
        msg.setRevealed(room.isRevealed());
        msg.setCreatorId(room.getCreatorId());
        msg.setCardSet(room.getCardSet());
        msg.setStoryTitle(room.getStoryTitle());
        msg.setAutoReveal(room.isAutoReveal());
        msg.setSpecialEffects(room.isSpecialEffects());

        List<RoomUpdateMessage.UserDto> userDtos = room.getUsers().stream()
                .map(u -> {
                    Object vote;
                    if (room.isRevealed()) {
                        vote = u.getActualVote();
                    } else {
                        vote = (u.getActualVote() != null) ? "voted" : null;
                    }
                    return new RoomUpdateMessage.UserDto(u.getId(), u.getName(), vote, u.isObserver());
                })
                .collect(Collectors.toList());
        msg.setUsers(userDtos);

        if (room.isRevealed()) {
            msg.setStats(calculateStats(room));
        }

        return msg;
    }

    private RoomUpdateMessage.StatsDto calculateStats(Room room) {
        List<Double> numericVotes = room.getUsers().stream()
                .filter(u -> !u.isObserver())
                .map(RoomUser::getActualVote)
                .filter(v -> v != null)
                .map(v -> {
                    try { return Double.parseDouble(v.toString()); }
                    catch (NumberFormatException e) { return null; }
                })
                .filter(Objects::nonNull)
                .sorted()
                .collect(Collectors.toList());

        if (numericVotes.isEmpty()) return null;

        double sum = numericVotes.stream().mapToDouble(Double::doubleValue).sum();
        double average = sum / numericVotes.size();
        double min = numericVotes.get(0);
        double max = numericVotes.get(numericVotes.size() - 1);
        double median;
        int size = numericVotes.size();
        if (size % 2 == 0) {
            median = (numericVotes.get(size / 2 - 1) + numericVotes.get(size / 2)) / 2.0;
        } else {
            median = numericVotes.get(size / 2);
        }

        return new RoomUpdateMessage.StatsDto(average, median, min, max);
    }

    // ---- Cleanup old rooms --------------------------------------------------

    @Scheduled(fixedDelay = 3600000) // every hour
    public synchronized void cleanupOldRooms() {
        Instant cutoff = Instant.now().minusSeconds(86400); // 24 hours
        rooms.entrySet().removeIf(entry -> {
            if (entry.getValue().getCreatedAt().isBefore(cutoff)) {
                log.info("Cleaning up stale room {}", entry.getKey());
                return true;
            }
            return false;
        });
    }

    // ---- Accessors for testing ----------------------------------------------

    public Map<String, Room> getRooms() { return rooms; }
    public Map<String, String> getSessionToRoom() { return sessionToRoom; }
}
