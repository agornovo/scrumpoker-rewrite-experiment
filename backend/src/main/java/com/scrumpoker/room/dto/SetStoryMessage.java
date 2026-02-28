package com.scrumpoker.room.dto;

public class SetStoryMessage {
    private String roomId;
    private String storyTitle;

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }
    public String getStoryTitle() { return storyTitle; }
    public void setStoryTitle(String storyTitle) { this.storyTitle = storyTitle; }
}
