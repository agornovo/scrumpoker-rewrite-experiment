package com.scrumpoker.room.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public class RoomUpdateMessage {

    private String roomId;
    private List<UserDto> users;
    private boolean revealed;
    private StatsDto stats;
    private String creatorId;
    private String cardSet;
    private String storyTitle;
    private boolean autoReveal;
    private boolean specialEffects;

    public static class UserDto {
        private String id;
        private String name;
        private Object vote;
        private boolean isObserver;

        public UserDto() {}

        public UserDto(String id, String name, Object vote, boolean isObserver) {
            this.id = id;
            this.name = name;
            this.vote = vote;
            this.isObserver = isObserver;
        }

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public Object getVote() { return vote; }
        public void setVote(Object vote) { this.vote = vote; }
        @JsonProperty("isObserver")
        public boolean isObserver() { return isObserver; }
        public void setObserver(boolean observer) { isObserver = observer; }
    }

    public static class StatsDto {
        private double average;
        private double median;
        private double min;
        private double max;

        public StatsDto() {}

        public StatsDto(double average, double median, double min, double max) {
            this.average = average;
            this.median = median;
            this.min = min;
            this.max = max;
        }

        public double getAverage() { return average; }
        public void setAverage(double average) { this.average = average; }
        public double getMedian() { return median; }
        public void setMedian(double median) { this.median = median; }
        public double getMin() { return min; }
        public void setMin(double min) { this.min = min; }
        public double getMax() { return max; }
        public void setMax(double max) { this.max = max; }
    }

    public RoomUpdateMessage() {}

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }
    public List<UserDto> getUsers() { return users; }
    public void setUsers(List<UserDto> users) { this.users = users; }
    public boolean isRevealed() { return revealed; }
    public void setRevealed(boolean revealed) { this.revealed = revealed; }
    public StatsDto getStats() { return stats; }
    public void setStats(StatsDto stats) { this.stats = stats; }
    public String getCreatorId() { return creatorId; }
    public void setCreatorId(String creatorId) { this.creatorId = creatorId; }
    public String getCardSet() { return cardSet; }
    public void setCardSet(String cardSet) { this.cardSet = cardSet; }
    public String getStoryTitle() { return storyTitle; }
    public void setStoryTitle(String storyTitle) { this.storyTitle = storyTitle; }
    public boolean isAutoReveal() { return autoReveal; }
    public void setAutoReveal(boolean autoReveal) { this.autoReveal = autoReveal; }
    public boolean isSpecialEffects() { return specialEffects; }
    public void setSpecialEffects(boolean specialEffects) { this.specialEffects = specialEffects; }
}
