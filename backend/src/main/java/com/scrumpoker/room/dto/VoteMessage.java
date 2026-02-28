package com.scrumpoker.room.dto;

public class VoteMessage {
    private String roomId;
    private Object vote;

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }
    public Object getVote() { return vote; }
    public void setVote(Object vote) { this.vote = vote; }
}
