package com.scrumpoker.room;

import com.scrumpoker.room.dto.JoinRoomMessage;
import com.scrumpoker.room.dto.RoomUpdateMessage;
import com.scrumpoker.room.dto.VoteMessage;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.*;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

import java.lang.reflect.Type;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class RoomControllerIntegrationTest {

    @LocalServerPort
    private int port;

    private WebSocketStompClient stompClient;
    private StompSession session;

    @BeforeEach
    void setUp() throws Exception {
        stompClient = new WebSocketStompClient(new StandardWebSocketClient());
        stompClient.setMessageConverter(new MappingJackson2MessageConverter());

        String url = "ws://localhost:" + port + "/ws-raw";
        CompletableFuture<StompSession> future = new CompletableFuture<>();
        stompClient.connectAsync(url, new WebSocketHttpHeaders(), new StompSessionHandlerAdapter() {
            @Override
            public void afterConnected(StompSession s, StompHeaders connectedHeaders) {
                future.complete(s);
            }

            @Override
            public void handleTransportError(StompSession s, Throwable exception) {
                future.completeExceptionally(exception);
            }
        });
        session = future.get(10, TimeUnit.SECONDS);
    }

    @AfterEach
    void tearDown() {
        if (session != null && session.isConnected()) {
            session.disconnect();
        }
        stompClient.stop();
    }

    /**
     * Subscribe to a room topic and return a queue that receives updates.
     * Waits briefly to ensure the SUBSCRIBE frame is processed by the broker.
     */
    private BlockingQueue<RoomUpdateMessage> subscribeToRoom(String roomId) throws InterruptedException {
        BlockingQueue<RoomUpdateMessage> updates = new LinkedBlockingQueue<>();
        session.subscribe("/topic/room/" + roomId, new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return RoomUpdateMessage.class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                updates.add((RoomUpdateMessage) payload);
            }
        });
        Thread.sleep(500);
        return updates;
    }

    @Test
    void joinRoom_broadcastsRoomUpdate() throws Exception {
        String roomId = "test-room-" + UUID.randomUUID();
        BlockingQueue<RoomUpdateMessage> updates = subscribeToRoom(roomId);

        JoinRoomMessage join = new JoinRoomMessage();
        join.setRoomId(roomId);
        join.setUserName("Alice");
        join.setCardSet("standard");
        join.setClientId("client-alice");
        session.send("/app/room/join", join);

        RoomUpdateMessage update = updates.poll(5, TimeUnit.SECONDS);
        assertThat(update).isNotNull();
        assertThat(update.getRoomId()).isEqualTo(roomId);
        assertThat(update.getUsers()).hasSize(1);
        assertThat(update.getUsers().get(0).getName()).isEqualTo("Alice");
        assertThat(update.isRevealed()).isFalse();
    }

    @Test
    void vote_maskedBeforeReveal() throws Exception {
        String roomId = "test-vote-" + UUID.randomUUID();
        BlockingQueue<RoomUpdateMessage> updates = subscribeToRoom(roomId);

        JoinRoomMessage join = new JoinRoomMessage();
        join.setRoomId(roomId);
        join.setUserName("Alice");
        join.setCardSet("standard");
        join.setClientId("c1");
        session.send("/app/room/join", join);
        updates.poll(5, TimeUnit.SECONDS);

        VoteMessage voteMsg = new VoteMessage();
        voteMsg.setRoomId(roomId);
        voteMsg.setVote("5");
        session.send("/app/room/vote", voteMsg);

        RoomUpdateMessage afterVote = updates.poll(5, TimeUnit.SECONDS);
        assertThat(afterVote).isNotNull();
        assertThat(afterVote.getUsers().get(0).getVote()).isEqualTo("voted");
    }

    @Test
    void revealAndReset_fullRound() throws Exception {
        String roomId = "test-round-" + UUID.randomUUID();
        BlockingQueue<RoomUpdateMessage> updates = subscribeToRoom(roomId);

        JoinRoomMessage join = new JoinRoomMessage();
        join.setRoomId(roomId);
        join.setUserName("Host");
        join.setCardSet("standard");
        join.setClientId("c-host");
        session.send("/app/room/join", join);
        updates.poll(5, TimeUnit.SECONDS);

        VoteMessage voteMsg = new VoteMessage();
        voteMsg.setRoomId(roomId);
        voteMsg.setVote("8");
        session.send("/app/room/vote", voteMsg);
        updates.poll(5, TimeUnit.SECONDS);

        Map<String, String> revealMsg = Map.of("roomId", roomId);
        session.send("/app/room/reveal", revealMsg);

        RoomUpdateMessage revealed = updates.poll(5, TimeUnit.SECONDS);
        assertThat(revealed).isNotNull();
        assertThat(revealed.isRevealed()).isTrue();
        assertThat(revealed.getUsers().get(0).getVote()).isEqualTo("8");
        assertThat(revealed.getStats()).isNotNull();

        session.send("/app/room/reset", revealMsg);

        RoomUpdateMessage reset = updates.poll(5, TimeUnit.SECONDS);
        assertThat(reset).isNotNull();
        assertThat(reset.isRevealed()).isFalse();
        assertThat(reset.getStoryTitle()).isEmpty();
    }

    @Test
    void setStoryTitle_updatesTitle() throws Exception {
        String roomId = "test-story-" + UUID.randomUUID();
        BlockingQueue<RoomUpdateMessage> updates = subscribeToRoom(roomId);

        JoinRoomMessage join = new JoinRoomMessage();
        join.setRoomId(roomId);
        join.setUserName("Alice");
        join.setCardSet("standard");
        join.setClientId("c1");
        session.send("/app/room/join", join);
        updates.poll(5, TimeUnit.SECONDS);

        Map<String, String> storyMsg = Map.of("roomId", roomId, "storyTitle", "SCRUM-123");
        session.send("/app/room/story", storyMsg);

        RoomUpdateMessage update = updates.poll(5, TimeUnit.SECONDS);
        assertThat(update).isNotNull();
        assertThat(update.getStoryTitle()).isEqualTo("SCRUM-123");
    }

    @Test
    void autoReveal_triggersRevealWhenAllVoted() throws Exception {
        String roomId = "test-ar-" + UUID.randomUUID();
        BlockingQueue<RoomUpdateMessage> updates = subscribeToRoom(roomId);

        JoinRoomMessage join = new JoinRoomMessage();
        join.setRoomId(roomId);
        join.setUserName("Alice");
        join.setCardSet("standard");
        join.setClientId("c1");
        session.send("/app/room/join", join);
        updates.poll(5, TimeUnit.SECONDS);

        Map<String, Object> arMsg = Map.of("roomId", roomId, "autoReveal", true);
        session.send("/app/room/auto-reveal", arMsg);
        updates.poll(5, TimeUnit.SECONDS);

        VoteMessage voteMsg = new VoteMessage();
        voteMsg.setRoomId(roomId);
        voteMsg.setVote("5");
        session.send("/app/room/vote", voteMsg);

        RoomUpdateMessage update = updates.poll(5, TimeUnit.SECONDS);
        assertThat(update).isNotNull();
        if (!update.isRevealed()) {
            update = updates.poll(3, TimeUnit.SECONDS);
            assertThat(update).isNotNull();
        }
        assertThat(update.isRevealed()).isTrue();
    }
}
