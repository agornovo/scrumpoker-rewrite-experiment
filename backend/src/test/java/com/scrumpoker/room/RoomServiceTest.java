package com.scrumpoker.room;

import com.scrumpoker.room.dto.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RoomServiceTest {

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private ScheduledExecutorService scheduledExecutorService;

    @Mock
    private ScheduledFuture<?> mockFuture;

    private RoomService roomService;

    @BeforeEach
    void setUp() {
        roomService = new RoomService(messagingTemplate, scheduledExecutorService);
        // Set short timeouts via reflection for tests
        setField(roomService, "reconnectGracePeriodMs", 100L);
        setField(roomService, "hostTakeoverTimeoutMs", 100L);
    }

    private void setField(Object target, String fieldName, Object value) {
        try {
            var field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private JoinRoomMessage joinMsg(String roomId, String userName, boolean observer, String clientId) {
        JoinRoomMessage msg = new JoinRoomMessage();
        msg.setRoomId(roomId);
        msg.setUserName(userName);
        msg.setObserver(observer);
        msg.setCardSet("standard");
        msg.setClientId(clientId);
        return msg;
    }

    // ---- Join ---------------------------------------------------------------

    @Test
    void joinRoom_createsRoomAndAddsUser() {
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1");

        Room room = roomService.getRooms().get("r1");
        assertThat(room).isNotNull();
        assertThat(room.getUsers()).hasSize(1);
        assertThat(room.getUsers().get(0).getName()).isEqualTo("Alice");
        assertThat(room.getCreatorId()).isEqualTo("s1");
    }

    @Test
    void joinRoom_secondUserJoinsExistingRoom() {
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1");
        roomService.joinRoom(joinMsg("r1", "Bob", false, "c2"), "s2");

        Room room = roomService.getRooms().get("r1");
        assertThat(room.getUsers()).hasSize(2);
        assertThat(room.getCreatorId()).isEqualTo("s1"); // host unchanged
    }

    @Test
    void joinRoom_observerDoesNotVote() {
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1");
        roomService.joinRoom(joinMsg("r1", "Observer", true, "c2"), "s2");

        Room room = roomService.getRooms().get("r1");
        RoomUser observer = room.getUsers().get(1);
        assertThat(observer.isObserver()).isTrue();
    }

    @Test
    void joinRoom_defaultsToStandardCardSetForUnknownSet() {
        JoinRoomMessage msg = joinMsg("r1", "Alice", false, "c1");
        msg.setCardSet("unknown");
        roomService.joinRoom(msg, "s1");

        assertThat(roomService.getRooms().get("r1").getCardSet()).isEqualTo("standard");
    }

    @Test
    void joinRoom_nullCardSetDefaultsToStandard() {
        JoinRoomMessage msg = joinMsg("r1", "Alice", false, "c1");
        msg.setCardSet(null);
        roomService.joinRoom(msg, "s1");

        assertThat(roomService.getRooms().get("r1").getCardSet()).isEqualTo("standard");
    }

    @Test
    void joinRoom_recognizesAllCardSets() {
        for (String cs : new String[]{"standard", "fibonacci", "tshirt", "powers2"}) {
            String roomId = "room-" + cs;
            JoinRoomMessage msg = joinMsg(roomId, "Alice", false, "c-" + cs);
            msg.setCardSet(cs);
            roomService.joinRoom(msg, "s-" + cs);
            assertThat(roomService.getRooms().get(roomId).getCardSet()).isEqualTo(cs);
        }
    }

    // ---- Vote ---------------------------------------------------------------

    @Test
    void castVote_recordsVoteAsMasked() {
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1");

        VoteMessage vote = new VoteMessage();
        vote.setRoomId("r1");
        vote.setVote("5");
        roomService.castVote(vote, "s1");

        Room room = roomService.getRooms().get("r1");
        RoomUser user = room.findUserBySessionId("s1");
        assertThat(user.getActualVote()).isEqualTo("5");
        assertThat(user.getVote()).isEqualTo("voted");
    }

    @Test
    void castVote_ignoredIfRoomNotFound() {
        VoteMessage vote = new VoteMessage();
        vote.setRoomId("nonexistent");
        vote.setVote("5");
        roomService.castVote(vote, "s1"); // should not throw
    }

    @Test
    void castVote_ignoredIfRevealed() {
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1");
        // Reveal first
        roomService.revealCards("r1", "s1");

        VoteMessage vote = new VoteMessage();
        vote.setRoomId("r1");
        vote.setVote("5");
        roomService.castVote(vote, "s1");

        RoomUser user = roomService.getRooms().get("r1").findUserBySessionId("s1");
        assertThat(user.getActualVote()).isNull();
    }

    @Test
    void castVote_observerCannotVote() {
        roomService.joinRoom(joinMsg("r1", "Host", false, "c1"), "s1");
        roomService.joinRoom(joinMsg("r1", "Observer", true, "c2"), "s2");

        VoteMessage vote = new VoteMessage();
        vote.setRoomId("r1");
        vote.setVote("5");
        roomService.castVote(vote, "s2");

        RoomUser observer = roomService.getRooms().get("r1").findUserBySessionId("s2");
        assertThat(observer.getActualVote()).isNull();
    }

    // ---- Reveal -------------------------------------------------------------

    @Test
    void revealCards_unmaskesVotes() {
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1");

        VoteMessage vote = new VoteMessage();
        vote.setRoomId("r1");
        vote.setVote("8");
        roomService.castVote(vote, "s1");

        roomService.revealCards("r1", "s1");

        Room room = roomService.getRooms().get("r1");
        assertThat(room.isRevealed()).isTrue();
        assertThat(room.findUserBySessionId("s1").getVote()).isEqualTo("8");
    }

    @Test
    void revealCards_nonHostCannotReveal() {
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1");
        roomService.joinRoom(joinMsg("r1", "Bob", false, "c2"), "s2");

        roomService.revealCards("r1", "s2"); // not host

        assertThat(roomService.getRooms().get("r1").isRevealed()).isFalse();
    }

    @Test
    void revealCards_roomNotFound_doesNotThrow() {
        roomService.revealCards("nonexistent", "s1");
    }

    // ---- Reset --------------------------------------------------------------

    @Test
    void resetRound_clearsVotesAndTitle() {
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1");

        VoteMessage vote = new VoteMessage();
        vote.setRoomId("r1");
        vote.setVote("5");
        roomService.castVote(vote, "s1");
        roomService.revealCards("r1", "s1");

        SetStoryMessage storyMsg = new SetStoryMessage();
        storyMsg.setRoomId("r1");
        storyMsg.setStoryTitle("Story 1");
        roomService.setStoryTitle("r1", "Story 1", "s1");

        roomService.resetRound("r1", "s1");

        Room room = roomService.getRooms().get("r1");
        assertThat(room.isRevealed()).isFalse();
        assertThat(room.getStoryTitle()).isEmpty();
        assertThat(room.findUserBySessionId("s1").getActualVote()).isNull();
        assertThat(room.getRoundHistory()).hasSize(1);
    }

    @Test
    void resetRound_nonRevealedDoesNotSaveHistory() {
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1");
        roomService.resetRound("r1", "s1");

        assertThat(roomService.getRooms().get("r1").getRoundHistory()).isEmpty();
    }

    @Test
    void resetRound_nonHostCannotReset() {
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1");
        roomService.joinRoom(joinMsg("r1", "Bob", false, "c2"), "s2");

        VoteMessage vote = new VoteMessage();
        vote.setRoomId("r1");
        vote.setVote("5");
        roomService.castVote(vote, "s1");
        roomService.revealCards("r1", "s1");

        roomService.resetRound("r1", "s2"); // not host
        assertThat(roomService.getRooms().get("r1").isRevealed()).isTrue();
    }

    // ---- Story title --------------------------------------------------------

    @Test
    void setStoryTitle_updatesTitle() {
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1");
        roomService.setStoryTitle("r1", "My Story", "s1");

        assertThat(roomService.getRooms().get("r1").getStoryTitle()).isEqualTo("My Story");
    }

    @Test
    void setStoryTitle_nullBecomesEmpty() {
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1");
        roomService.setStoryTitle("r1", null, "s1");

        assertThat(roomService.getRooms().get("r1").getStoryTitle()).isEmpty();
    }

    @Test
    void setStoryTitle_nonHostIgnored() {
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1");
        roomService.joinRoom(joinMsg("r1", "Bob", false, "c2"), "s2");
        roomService.setStoryTitle("r1", "Hacked", "s2");

        assertThat(roomService.getRooms().get("r1").getStoryTitle()).isEmpty();
    }

    // ---- Auto-reveal --------------------------------------------------------

    @Test
    void autoReveal_triggersRevealWhenAllVoted() {
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1");

        SetAutoRevealMessage ar = new SetAutoRevealMessage();
        ar.setRoomId("r1");
        ar.setAutoReveal(true);
        roomService.setAutoReveal("r1", true, "s1");

        VoteMessage vote = new VoteMessage();
        vote.setRoomId("r1");
        vote.setVote("3");
        roomService.castVote(vote, "s1");

        assertThat(roomService.getRooms().get("r1").isRevealed()).isTrue();
    }

    @Test
    void autoReveal_doesNotTriggerWithNoVoters() {
        roomService.joinRoom(joinMsg("r1", "Alice", true, "c1"), "s1"); // observer
        roomService.setAutoReveal("r1", true, "s1");

        assertThat(roomService.getRooms().get("r1").isRevealed()).isFalse();
    }

    @Test
    void autoReveal_nonHostCannotSet() {
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1");
        roomService.joinRoom(joinMsg("r1", "Bob", false, "c2"), "s2");
        roomService.setAutoReveal("r1", true, "s2");

        assertThat(roomService.getRooms().get("r1").isAutoReveal()).isFalse();
    }

    // ---- Remove participant -------------------------------------------------

    @Test
    void removeParticipant_removesUser() {
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1");
        roomService.joinRoom(joinMsg("r1", "Bob", false, "c2"), "s2");

        roomService.removeParticipant("r1", "s2", "s1");

        Room room = roomService.getRooms().get("r1");
        assertThat(room.getUsers()).hasSize(1);
        assertThat(room.findUserBySessionId("s2")).isNull();
        verify(messagingTemplate).convertAndSendToUser(eq("s2"), eq("/queue/events"), any());
    }

    @Test
    void removeParticipant_nonHostCannotRemove() {
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1");
        roomService.joinRoom(joinMsg("r1", "Bob", false, "c2"), "s2");

        roomService.removeParticipant("r1", "s1", "s2"); // s2 not host

        assertThat(roomService.getRooms().get("r1").getUsers()).hasSize(2);
    }

    @Test
    void removeParticipant_roomNotFound_doesNotThrow() {
        roomService.removeParticipant("nonexistent", "s2", "s1");
    }

    @Test
    void removeParticipant_participantNotFound_doesNotThrow() {
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1");
        roomService.removeParticipant("r1", "nonexistent", "s1");
    }

    // ---- Claim host ---------------------------------------------------------

    @Test
    void claimHost_allowedWhenHostAbsent() {
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1");
        roomService.joinRoom(joinMsg("r1", "Bob", false, "c2"), "s2");

        // Mark host as disconnected
        Room room = roomService.getRooms().get("r1");
        room.findUserBySessionId("s1").setConnected(false);

        roomService.claimHost("r1", "s2");

        assertThat(room.getCreatorId()).isEqualTo("s2");
    }

    @Test
    void claimHost_notAllowedWhenHostPresent() {
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1");
        roomService.joinRoom(joinMsg("r1", "Bob", false, "c2"), "s2");

        roomService.claimHost("r1", "s2");

        assertThat(roomService.getRooms().get("r1").getCreatorId()).isEqualTo("s1");
    }

    @Test
    void claimHost_roomNotFound_doesNotThrow() {
        roomService.claimHost("nonexistent", "s1");
    }

    // ---- Leave --------------------------------------------------------------

    @Test
    void leaveRoom_removesUser() {
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1");
        roomService.joinRoom(joinMsg("r1", "Bob", false, "c2"), "s2");

        roomService.leaveRoom("r1", "s2");

        assertThat(roomService.getRooms().get("r1").getUsers()).hasSize(1);
    }

    @Test
    void leaveRoom_hostLeaveTransfersHost() {
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1");
        roomService.joinRoom(joinMsg("r1", "Bob", false, "c2"), "s2");

        roomService.leaveRoom("r1", "s1");

        assertThat(roomService.getRooms().get("r1").getCreatorId()).isEqualTo("s2");
    }

    @Test
    void leaveRoom_nonExistentRoom_doesNotThrow() {
        roomService.leaveRoom("nonexistent", "s1");
    }

    // ---- Stats calculation --------------------------------------------------

    @Test
    void buildUpdate_statsCalculatedOnReveal() {
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1");
        roomService.joinRoom(joinMsg("r1", "Bob", false, "c2"), "s2");

        castVoteForUser("r1", "s1", "3");
        castVoteForUser("r1", "s2", "5");

        roomService.revealCards("r1", "s1");

        RoomUpdateMessage update = roomService.buildUpdate(roomService.getRooms().get("r1"));
        assertThat(update.getStats()).isNotNull();
        assertThat(update.getStats().getAverage()).isEqualTo(4.0);
        assertThat(update.getStats().getMin()).isEqualTo(3.0);
        assertThat(update.getStats().getMax()).isEqualTo(5.0);
        assertThat(update.getStats().getMedian()).isEqualTo(4.0);
    }

    @Test
    void buildUpdate_statsNullForNonNumericVotes() {
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1");
        castVoteForUser("r1", "s1", "?");
        roomService.revealCards("r1", "s1");

        RoomUpdateMessage update = roomService.buildUpdate(roomService.getRooms().get("r1"));
        assertThat(update.getStats()).isNull();
    }

    @Test
    void buildUpdate_statsWithEvenNumberOfVotes_medianIsAverage() {
        roomService.joinRoom(joinMsg("r1", "A", false, "c1"), "s1");
        roomService.joinRoom(joinMsg("r1", "B", false, "c2"), "s2");
        roomService.joinRoom(joinMsg("r1", "C", false, "c3"), "s3");
        roomService.joinRoom(joinMsg("r1", "D", false, "c4"), "s4");

        castVoteForUser("r1", "s1", "2");
        castVoteForUser("r1", "s2", "4");
        castVoteForUser("r1", "s3", "6");
        castVoteForUser("r1", "s4", "8");

        roomService.revealCards("r1", "s1");

        RoomUpdateMessage update = roomService.buildUpdate(roomService.getRooms().get("r1"));
        assertThat(update.getStats().getMedian()).isEqualTo(5.0);
    }

    @Test
    void buildUpdate_votesMaskedWhenNotRevealed() {
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1");
        castVoteForUser("r1", "s1", "8");

        RoomUpdateMessage update = roomService.buildUpdate(roomService.getRooms().get("r1"));
        assertThat(update.getUsers().get(0).getVote()).isEqualTo("voted");
        assertThat(update.isRevealed()).isFalse();
    }

    @Test
    void buildUpdate_nullVoteMaskedAsNull() {
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1");

        RoomUpdateMessage update = roomService.buildUpdate(roomService.getRooms().get("r1"));
        assertThat(update.getUsers().get(0).getVote()).isNull();
    }

    // ---- Disconnect / Reconnect ---------------------------------------------

    @Test
    @SuppressWarnings("unchecked")
    void handleDisconnect_schedulesRemoval() {
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1");

        when(scheduledExecutorService.schedule(any(Runnable.class), anyLong(), any()))
                .thenReturn((ScheduledFuture) mockFuture);

        roomService.handleDisconnect("s1");

        // schedules grace-period removal + host absent timer (s1 is the host)
        verify(scheduledExecutorService, atLeast(1)).schedule(any(Runnable.class), anyLong(), any());
    }

    @Test
    @SuppressWarnings("unchecked")
    void handleDisconnect_unknownSession_doesNotSchedule() {
        roomService.handleDisconnect("unknown-session");
        verify(scheduledExecutorService, never()).schedule(any(Runnable.class), anyLong(), any());
    }

    @Test
    @SuppressWarnings("unchecked")
    void reconnect_cancelsPendingRemoval() {
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1");

        when(scheduledExecutorService.schedule(any(Runnable.class), anyLong(), any()))
                .thenReturn((ScheduledFuture) mockFuture);

        roomService.handleDisconnect("s1");

        // Reconnect with same clientId but new sessionId
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1-new");

        // Both grace-period and host-absent timers should be cancelled
        verify(mockFuture, atLeast(1)).cancel(false);
        // User should be in room with new sessionId
        Room room = roomService.getRooms().get("r1");
        assertThat(room.findUserBySessionId("s1-new")).isNotNull();
        assertThat(room.findUserBySessionId("s1")).isNull();
    }

    @Test
    @SuppressWarnings("unchecked")
    void reconnect_hostRestored() {
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1");

        when(scheduledExecutorService.schedule(any(Runnable.class), anyLong(), any()))
                .thenReturn((ScheduledFuture) mockFuture);

        roomService.handleDisconnect("s1");
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1-new");

        assertThat(roomService.getRooms().get("r1").getCreatorId()).isEqualTo("s1-new");
    }

    @Test
    @SuppressWarnings("unchecked")
    void handleDisconnect_hostTriggersHostAbsentTimer() {
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1");

        when(scheduledExecutorService.schedule(any(Runnable.class), anyLong(), any()))
                .thenReturn((ScheduledFuture) mockFuture);

        roomService.handleDisconnect("s1");

        // Should schedule twice: once for removal, once for host absent
        verify(scheduledExecutorService, times(2)).schedule(any(Runnable.class), anyLong(), any());
    }

    // ---- Cleanup ------------------------------------------------------------

    @Test
    void cleanupOldRooms_removesStaleRooms() throws Exception {
        roomService.joinRoom(joinMsg("r1", "Alice", false, "c1"), "s1");

        // Inject an old room by adding it directly and then time-traveling its createdAt via a subclass trick
        // Since Room.createdAt is final, we use a helper method to access and set via VarHandle.
        Room freshRoom = roomService.getRooms().get("r1");
        assertThat(freshRoom).isNotNull();

        // Create a stale room that was created 25 hours ago
        Room staleRoom = createStaleRoom("old-room");
        roomService.getRooms().put("old-room", staleRoom);

        roomService.cleanupOldRooms();

        assertThat(roomService.getRooms().containsKey("old-room")).isFalse();
        assertThat(roomService.getRooms().containsKey("r1")).isTrue();
    }

    // ---- Helper methods -----------------------------------------------------

    private void castVoteForUser(String roomId, String sessionId, String voteValue) {
        VoteMessage vote = new VoteMessage();
        vote.setRoomId(roomId);
        vote.setVote(voteValue);
        roomService.castVote(vote, sessionId);
    }

    private Room createStaleRoom(String roomId) {
        Room room = new Room(roomId, "sx", "standard", false);
        room.setCreatedAt(java.time.Instant.now().minusSeconds(90000));
        return room;
    }

    private void setCreatedAt(Room room, java.time.Instant instant) {
        room.setCreatedAt(instant);
    }
}
