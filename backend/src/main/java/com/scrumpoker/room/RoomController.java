package com.scrumpoker.room;

import com.scrumpoker.room.dto.*;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

@Controller
public class RoomController {

    private final RoomService roomService;

    public RoomController(RoomService roomService) {
        this.roomService = roomService;
    }

    @MessageMapping("/room/join")
    public void join(JoinRoomMessage msg, SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        roomService.joinRoom(msg, sessionId);
    }

    @MessageMapping("/room/vote")
    public void vote(VoteMessage msg, SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        roomService.castVote(msg, sessionId);
    }

    @MessageMapping("/room/reveal")
    public void reveal(RoomActionMessage msg, SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        roomService.revealCards(msg.getRoomId(), sessionId);
    }

    @MessageMapping("/room/reset")
    public void reset(RoomActionMessage msg, SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        roomService.resetRound(msg.getRoomId(), sessionId);
    }

    @MessageMapping("/room/story")
    public void story(SetStoryMessage msg, SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        roomService.setStoryTitle(msg.getRoomId(), msg.getStoryTitle(), sessionId);
    }

    @MessageMapping("/room/auto-reveal")
    public void autoReveal(SetAutoRevealMessage msg, SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        roomService.setAutoReveal(msg.getRoomId(), msg.isAutoReveal(), sessionId);
    }

    @MessageMapping("/room/remove")
    public void remove(RemoveParticipantMessage msg, SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        roomService.removeParticipant(msg.getRoomId(), msg.getParticipantId(), sessionId);
    }

    @MessageMapping("/room/claim-host")
    public void claimHost(RoomActionMessage msg, SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        roomService.claimHost(msg.getRoomId(), sessionId);
    }

    @MessageMapping("/room/leave")
    public void leave(RoomActionMessage msg, SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        roomService.leaveRoom(msg.getRoomId(), sessionId);
    }

    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        String sessionId = event.getSessionId();
        roomService.handleDisconnect(sessionId);
    }
}
