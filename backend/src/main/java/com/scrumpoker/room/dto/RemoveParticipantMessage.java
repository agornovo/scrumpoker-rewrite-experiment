package com.scrumpoker.room.dto;

public class RemoveParticipantMessage {
    private String roomId;
    private String participantId;

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }
    public String getParticipantId() { return participantId; }
    public void setParticipantId(String participantId) { this.participantId = participantId; }
}
