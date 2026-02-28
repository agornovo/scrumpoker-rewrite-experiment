package com.scrumpoker.room;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

public class RoomUser {

    private final String id;         // sessionId
    private final String clientId;   // persistent client ID for reconnect
    private String name;
    private boolean observer;
    private Object vote;             // null, "voted" (masked), or actual value when revealed
    private Object actualVote;       // actual vote value always stored here
    private Instant connectedAt;
    private boolean connected;

    public RoomUser(String id, String clientId, String name, boolean observer) {
        this.id = id;
        this.clientId = clientId;
        this.name = name;
        this.observer = observer;
        this.vote = null;
        this.actualVote = null;
        this.connectedAt = Instant.now();
        this.connected = true;
    }

    public String getId() { return id; }
    public String getClientId() { return clientId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public boolean isObserver() { return observer; }
    public void setObserver(boolean observer) { this.observer = observer; }
    public Object getVote() { return vote; }
    public void setVote(Object vote) { this.vote = vote; }
    public Object getActualVote() { return actualVote; }
    public void setActualVote(Object actualVote) { this.actualVote = actualVote; }
    public Instant getConnectedAt() { return connectedAt; }
    public boolean isConnected() { return connected; }
    public void setConnected(boolean connected) { this.connected = connected; }
}
