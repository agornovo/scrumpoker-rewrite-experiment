package com.scrumpoker.room;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public class Room {

    public static final Map<String, List<String>> CARD_SETS = Map.of(
        "standard",  List.of("1", "2", "3", "5", "8", "13", "20", "40", "100", "?"),
        "fibonacci",  List.of("0", "0.5", "1", "2", "3", "5", "8", "13", "21", "34", "55", "?", "☕"),
        "tshirt",     List.of("XS", "S", "M", "L", "XL", "XXL", "?"),
        "powers2",    List.of("1", "2", "4", "8", "16", "32", "64", "?")
    );

    private final String id;
    private String creatorId;         // sessionId of current host
    private final List<RoomUser> users = new ArrayList<>();
    private boolean revealed = false;
    private String cardSet;
    private String storyTitle = "";
    private boolean autoReveal = false;
    private boolean specialEffects = false;
    private final List<RoundRecord> roundHistory = new ArrayList<>();
    private Instant createdAt = Instant.now();

    // clientId -> sessionId for reconnect tracking
    private final Map<String, String> clientIdToSessionId = new ConcurrentHashMap<>();

    public record RoundRecord(String storyTitle, List<Object> votes, Instant completedAt) {}

    public Room(String id, String creatorId, String cardSet, boolean specialEffects) {
        this.id = id;
        this.creatorId = creatorId;
        this.cardSet = cardSet;
        this.specialEffects = specialEffects;
    }

    public String getId() { return id; }
    public String getCreatorId() { return creatorId; }
    public void setCreatorId(String creatorId) { this.creatorId = creatorId; }
    public List<RoomUser> getUsers() { return users; }
    public boolean isRevealed() { return revealed; }
    public void setRevealed(boolean revealed) { this.revealed = revealed; }
    public String getCardSet() { return cardSet; }
    public void setCardSet(String cardSet) { this.cardSet = cardSet; }
    public String getStoryTitle() { return storyTitle; }
    public void setStoryTitle(String storyTitle) { this.storyTitle = storyTitle; }
    public boolean isAutoReveal() { return autoReveal; }
    public void setAutoReveal(boolean autoReveal) { this.autoReveal = autoReveal; }
    public boolean isSpecialEffects() { return specialEffects; }
    public void setSpecialEffects(boolean specialEffects) { this.specialEffects = specialEffects; }
    public List<RoundRecord> getRoundHistory() { return roundHistory; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Map<String, String> getClientIdToSessionId() { return clientIdToSessionId; }

    public RoomUser findUserBySessionId(String sessionId) {
        return users.stream().filter(u -> u.getId().equals(sessionId)).findFirst().orElse(null);
    }

    public RoomUser findUserByClientId(String clientId) {
        return users.stream().filter(u -> u.getClientId() != null && u.getClientId().equals(clientId)).findFirst().orElse(null);
    }

    public boolean allVotersVoted() {
        return users.stream()
                .filter(u -> !u.isObserver())
                .allMatch(u -> u.getActualVote() != null);
    }
}
