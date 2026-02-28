package com.scrumpoker.room.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class JoinRoomMessage {
    private String roomId;
    private String userName;
    private boolean isObserver;
    private String cardSet;
    private boolean specialEffects;
    private String clientId;

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }
    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }
    @JsonProperty("isObserver")
    public boolean isObserver() { return isObserver; }
    @JsonProperty("isObserver")
    public void setObserver(boolean observer) { isObserver = observer; }
    public String getCardSet() { return cardSet; }
    public void setCardSet(String cardSet) { this.cardSet = cardSet; }
    public boolean isSpecialEffects() { return specialEffects; }
    public void setSpecialEffects(boolean specialEffects) { this.specialEffects = specialEffects; }
    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }
}
