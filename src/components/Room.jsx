import React, { useState, useEffect, useRef } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import Peer from 'simple-peer';

import { roomSocket, chatSocket, peerSocket, getMySocketId } from '../utils/socket';

import Video, { StyledVideo } from './Video';
import SpeechGame from './SpeechGame';
import Chat from './Chat';
import Button from './Button';
import ErrorBox from './ErrorBox';

import { BsUnlockFill, BsLockFill, BsFillChatDotsFill } from 'react-icons/bs';
import {
  FaVideo,
  FaVideoSlash,
  FaVolumeMute,
  FaVolumeUp,
} from 'react-icons/fa';
import { IoIosExit } from 'react-icons/io';

function Room({
  user,
  room,
  renderRoom,
  destroyRoom,
  addMember,
  deleteMember,
  updateRoomLockingStatus,
  chatList,
  unreadChatCount,
  addChat,
  increaseUnreadCount,
  resetUnreadCount,
}) {
  const history = useHistory();
  const { room_id: roomId } = useParams();
  const [isChatRoomOpen, setIsChatRoomOpen] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamOptions, setStreamOptions] = useState({});
  const [error, setError] = useState('');
  const [peers, setPeers] = useState({});
  const peersRef = useRef({});
  const streamRef = useRef();
  const myVideoRef = useRef();

  useEffect(() => {
    roomSocket.joinRoom({ roomId, user }, async ({ room, message }) => {
      if (!room) return setError(message);

      renderRoom(room);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        myVideoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsStreaming(true);
        setStreamOptions({ audio: true, video: true });
      } catch (error) {
        setError(error.message);
      }
    });

    roomSocket.listenUpdateRoomLockingStatus(({ isLocked }) =>
      updateRoomLockingStatus(isLocked),
    );
    roomSocket.listenMemberJoined(({ newMember }) => addMember(newMember));
    roomSocket.listenMemberLeaved(({ socketId }) => {
      delete peersRef.current[socketId];
      setPeers(peers => {
        const { [socketId]: targetPeer, ...restPeers } = peers;
        if (targetPeer) targetPeer.destroy();
        return restPeers;
      });

      deleteMember(socketId);
    });

    chatSocket.listenMessage(({ chat }) => {
      addChat(chat);

      if (!isChatRoomOpen) {
        console.log('📌 : isChatRoomOpen', isChatRoomOpen);
        increaseUnreadCount();
      }
    });

    return () => {
      roomSocket.cleanUpRoomListener();
      chatSocket.cleanUpMessageListener();

      roomSocket.leaveRoom({ roomId });

      destroyRoom();

      if (!streamRef.current) return;

      streamRef.current.getVideoTracks().forEach(track => {
        track.stop();
        streamRef.current.removeTrack(track);
      });
    };
  }, []);

  useEffect(() => {
    console.log('📌 : isChatRoomOpen', isChatRoomOpen);
    if (!isChatRoomOpen) return;
    resetUnreadCount();
  }, [isChatRoomOpen]);

  useEffect(() => {
    if (room && user._id === room.memberList?.[0]._id) {
      setIsHost(true);
    }
  }, [room]);

  useEffect(() => {
    if (!isStreaming) return;

    for (const member of room.memberList) {
      if (user._id === member._id) continue;

      const peer = new Peer({
        initiator: true,
        trickle: false,
        stream: streamRef.current,
      });

      peer.on('signal', signal => {
        peerSocket.sendingSignal({ signal, receiver: member });
      });

      peersRef.current[member.socketId] = peer;
      setPeers(prev => ({ ...prev, [member.socketId]: peer }));
    }

    peerSocket.listenSendingSignal(({ initiator, signal }) => {
      const peer = new Peer({
        initiator: false,
        trickle: false,
        stream: streamRef.current,
      });
      peer.signal(signal);

      peer.on('signal', signal => {
        peerSocket.returnSignal({ signal, receiver: initiator });
      });

      peersRef.current[initiator.socketId] = peer;
      setPeers(prev => ({ ...prev, [initiator.socketId]: peer }));
    });

    peerSocket.listenReturningSignal(({ returner, signal }) => {
      const peer = peersRef.current[returner.socketId];
      peer.signal(signal);
    });

    return () => {
      peerSocket.cleanUpPeerListener();
    };
  }, [isStreaming]);

  const handleLockingRoom = () => {
    roomSocket.updateRoomLockingStatus({
      roomId: room._id,
      isLocked: !room.isLocked,
    });
  };

  const handleAudioTrack = () => {
    if (streamOptions.audio) {
      streamRef.current
        .getAudioTracks()
        .forEach(track => (track.enabled = false));
      setStreamOptions(prev => ({ ...prev, audio: false }));
    } else {
      streamRef.current
        .getAudioTracks()
        .forEach(track => (track.enabled = true));
      setStreamOptions(prev => ({ ...prev, audio: true }));
    }
  };

  const handleVideoTrack = () => {
    if (streamOptions.video) {
      streamRef.current
        .getVideoTracks()
        .forEach(track => (track.enabled = false));
      setStreamOptions(prev => ({ ...prev, video: false }));
    } else {
      streamRef.current
        .getVideoTracks()
        .forEach(track => (track.enabled = true));
      setStreamOptions(prev => ({ ...prev, video: true }));
    }
  };

  if (error) {
    return <ErrorBox message={error} text='메인으로' />;
  }

  return (
    <Container>
      {room && (
        <>
          <Button onClick={() => setIsChatRoomOpen(!isChatRoomOpen)}>
            <BsFillChatDotsFill size={28} />
            <div style={{ color: 'white', backgroundColor: 'red' }}>
              {unreadChatCount}
            </div>
          </Button>
          {isChatRoomOpen && (
            <Chat
              onSubmit={newChat => chatSocket.sendMessage({ newChat })}
              chatList={chatList}
              user={user}
            />
          )}
          <Header>
            <h1>{room.title}</h1>
            <span>{room.isLocked ? <BsLockFill /> : <BsUnlockFill />}</span>
          </Header>
          <Wrapper>
            <GameBox>
              <SpeechGame />
            </GameBox>
            <MemberList>
              {room.memberList.map(member => (
                <MemberBlock key={member.socketId}>
                  {member._id === user._id ? (
                    <StyledVideo
                      thumbnail={member.photoUrl}
                      ref={myVideoRef}
                      autoPlay
                      playsInline
                      muted
                    />
                  ) : (
                    <Video
                      thumbnail={member.photoUrl}
                      peer={peers[member.socketId]}
                    />
                  )}
                  <h3>{member.name}</h3>
                </MemberBlock>
              ))}
            </MemberList>
          </Wrapper>
          <UtilityBox>
            <div>
              {isHost && (
                <Button
                  color={room.isLocked ? '#eb3b5a' : '#d1d8e0'}
                  onClick={handleLockingRoom}>
                  {room.isLocked ? (
                    <BsLockFill color='#eee' size={24} />
                  ) : (
                    <BsUnlockFill size={24} />
                  )}
                </Button>
              )}
              <Button
                color={streamOptions.audio ? '#20bf6b' : '#d1d8e0'}
                onClick={handleAudioTrack}>
                {streamOptions.audio ? (
                  <FaVolumeUp size={24} />
                ) : (
                  <FaVolumeMute size={24} />
                )}
              </Button>
              <Button
                color={streamOptions.video ? '#20bf6b' : '#d1d8e0'}
                onClick={handleVideoTrack}>
                {streamOptions.video ? (
                  <FaVideo size={24} />
                ) : (
                  <FaVideoSlash size={24} />
                )}
              </Button>
              <IoIosExit
                onClick={() => history.push('/')}
                size={42}
                cursor='pointer'
                color='#eb3b5a'
              />
            </div>
          </UtilityBox>
        </>
      )}
    </Container>
  );
}

const Container = styled.div`
  background-color: #49007d;
  width: 100vw;
  height: 100vh;

  & > button {
    z-index: 999;
    width: 36px;
    height: 36px;
    padding: 12px;
    position: fixed;
    bottom: 24px;
    right: 100px;
    text-align: center;
  }
`;

const Wrapper = styled.div`
  display: flex;
  height: 92%;
`;

const Header = styled.header`
  width: inherit;
  height: 8%;
  background-color: #330057;
  display: flex;
  align-items: center;

  h1 {
    font-size: 24px;
    color: #ffd32a;
    margin: 0 16px 0 24px;
  }

  span {
    font-size: 21px;
    color: #eb3b5a;
  }
`;

const GameBox = styled.div`
  min-width: 400px;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;

  div {
    width: 320px;
    height: 600px;
    border-radius: 36px;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #a9c9ff;
    background-image: linear-gradient(180deg, #a9c9ff 0%, #ffbbec 100%);
  }
`;

const UtilityBox = styled.div`
  z-index: 1;
  width: 100%;
  height: 80px;
  position: fixed;
  left: 0px;
  bottom: 0px;
  border-radius: 18px;
  display: flex;
  justify-content: center;
  align-items: center;

  div {
    display: flex;
    align-items: center;
    background-color: #330057;
    padding: 10px 24px;
    border-radius: 20px;
    margin-bottom: 24px;
  }

  button:not(:last-child) {
    margin-right: 16px;
  }
`;

const MemberList = styled.div`
  width: 80vw;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  overflow-y: scroll;

  &::-webkit-scrollbar {
    display: none;
  }
`;

const MemberBlock = styled.div`
  margin: 20px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  h3 {
    color: #eee;
    margin-top: 24px;
    font-size: 18px;
  }
`;

export default Room;

Room.propTypes = {
  user: PropTypes.object,
  room: PropTypes.object,
  chatList: PropTypes.array,
  unreadChatCount: PropTypes.number,
  renderRoom: PropTypes.func.isRequired,
  destroyRoom: PropTypes.func.isRequired,
  addMember: PropTypes.func.isRequired,
  deleteMember: PropTypes.func.isRequired,
  addChat: PropTypes.func.isRequired,
  increaseUnreadCount: PropTypes.func.isRequired,
  resetUnreadCount: PropTypes.func.isRequired,
  updateRoomLockingStatus: PropTypes.func.isRequired,
};
