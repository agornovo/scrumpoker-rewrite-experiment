package com.scrumpoker.room.dto;

public class SetAutoRevealMessage {
    private String roomId;
    private boolean autoReveal;

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }
    public boolean isAutoReveal() { return autoReveal; }
    public void setAutoReveal(boolean autoReveal) { this.autoReveal = autoReveal; }
}
