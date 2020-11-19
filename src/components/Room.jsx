import React, { useState, useEffect, useRef } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import Peer from 'simple-peer';

import Video, { StyledVideo } from './Video';
import Chat from '../components/Chat';
import Button from './Button';
import SpeechGame from './SpeechGame';

import { BsUnlockFill, BsLockFill, BsFillChatDotsFill } from 'react-icons/bs';
import { FaVideo, FaVideoSlash, FaVolumeMute, FaVolumeUp } from 'react-icons/fa';
import { IoIosExit } from 'react-icons/io';

function Room({ user, socket, room, joinRoom, leaveRoom, addMember, deleteMember, updateRoomLockingStatus, addChat, chatList }) {
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
    console.log('Current Peers :', peers);
  }, [peers]);

  useEffect(() => {
    if (!socket) return;

    socket.emit('join room', { roomId, user }, async ({ room, message }) => {
      if (!room) return setError(message);
      joinRoom(room);

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

    socket.on('member joined', ({ user }) => addMember(user));
    socket.on('member leaved', ({ userId }) => {
      delete peersRef.current[userId];
      setPeers(peers => {
        const { [userId]: targetPeer, ...restPeers } = peers;

        if (targetPeer) {
          targetPeer.destroy();
        }

        return restPeers;
      });

      deleteMember(userId);
    });

    socket.on('recieve message', ({ chat }) => addChat(chat));

    socket.on('receive room locking status', ({ isLocked }) => updateRoomLockingStatus(isLocked));

    return () => {
      if (!socket) return;

      socket.off('member joined');
      socket.off('member leaved');

      socket.off('recieve message');

      streamRef.current.getVideoTracks().forEach(track => {
        track.stop();
        streamRef.current.removeTrack(track);
      });

      socket.emit('leave room', { roomId, userId: user.id });
      leaveRoom();
    };
  }, [socket]);

  useEffect(() => {
    if (room && user.id === room.memberList?.[0].id) {
      console.log(room);
      setIsHost(true);
    }
  }, [room]);

  useEffect(() => {
    if (!isStreaming) return;

    for (const member of room.memberList) {
      const sender = { ...user, socketId: socket.id };
      const receiver = member;

      if (sender.id === receiver.id) continue;

      const peer = new Peer({
        initiator: true,
        trickle: false,
        stream: streamRef.current,
      });

      peer.on('signal', senderSignal => {
        socket.emit('sending signal', { sender, senderSignal, receiver });
      });

      peersRef.current[receiver.id] = peer;
      setPeers(prev => ({ ...prev, [receiver.id]: peer }));
    }

    /* ----SERVER-----
      socket.on('sending signal', ({ sender, senderSignal, receiver }) => {
        const { socketId } = receiver;
        io.to(socketId).emit('receiving signal', { sender, senderSignal });
      });
    ----SERVER----- */

    socket.on('receiving signal', ({ sender, senderSignal }) => {
      const peer = new Peer({
        initiator: false,
        trickle: false,
        stream: streamRef.current,
      });

      peer.signal(senderSignal);

      const receiver = { ...user, socketId: socket.id };
      peer.on('signal', receiverSignal => {
        socket.emit('returning signal', { receiver, receiverSignal, sender });
      });

      peersRef.current[sender.id] = peer;
      setPeers(prev => ({ ...prev, [sender.id]: peer }));
    });

    /* ----SERVER-----
      socket.on('returning signal', ({ receiver, receiverSignal, sender }) => {
        const { socketId } = sender;
        io.to(socketId).emit('receiving returned signal', { receiver, receiverSignal });
      });
    ----SERVER----- */

    socket.on('receiving returned signal', ({ receiver, receiverSignal }) => {
      const peer = peersRef.current[receiver.id];
      peer.signal(receiverSignal);
    });

    return () => {
      if (!isStreaming) return;

      socket.off('receiving signal');
      socket.off('receiving returned signal');
    };
  }, [isStreaming]);


  const handleLockingRoom = () => {
    socket.emit('send room locking status', { roomId: room.id, isLocked: !room.isLocked });
  };

  const handleAudioTrack = () => {
    if (streamOptions.audio) {
      streamRef.current.getAudioTracks().forEach(track => track.enabled = false);
      setStreamOptions(prev => ({ ...prev, audio: false }));
    } else {
      streamRef.current.getAudioTracks().forEach(track => track.enabled = true);
      setStreamOptions(prev => ({ ...prev, audio: true }));
    }
  };

  const handleVideoTrack = () => {
    if (streamOptions.video) {
      streamRef.current.getVideoTracks().forEach(track => track.enabled = false);
      setStreamOptions(prev => ({ ...prev, video: false }));
    } else {
      streamRef.current.getVideoTracks().forEach(track => track.enabled = true);
      setStreamOptions(prev => ({ ...prev, video: true }));
    }
  };

  if (!room || error) {
    return (
      <div>
        <h1>{error}</h1>
        <Button onClick={() => history.push('/')} text='메인으로' />
      </div>
    );
  }

  return (
    <Container>
      <Button onClick={() => setIsChatRoomOpen(!isChatRoomOpen)}>
        <BsFillChatDotsFill size={28} />
      </Button>
      {isChatRoomOpen &&
        <Chat
          onSubmit={newChat => {
            console.log('Room -> newChat', newChat);
            socket.emit('send message', { chat: newChat });
          }}
          chatList={chatList}
          user={user}
        />
      }
      <Header>
        <h1>{room.roomName}</h1>
        <span>{room.isLocked ? <BsLockFill /> : <BsUnlockFill />}</span>
      </Header>
      <Wrapper>
        <GameBox><div><SpeechGame /></div></GameBox>
        <MemberList>
          {room.memberList.map(member => (
            <MemberBlock key={member.id}>
              {member.id === user.id ?
                  <StyledVideo
                    thumbnail={member.photoUrl}
                    ref={myVideoRef}
                    autoPlay
                    playsInline
                    muted
                  />
                :
                  <Video
                    key={member.id}
                    thumbnail={member.photoUrl}
                    peer={peers[member.id]}
                  />
              }
              <h3>{member.name}</h3>
            </MemberBlock>
          ))}
        </MemberList>
      </Wrapper>
      <UtilityBox>
        <div>
          {
            isHost &&
            <Button color={room.isLocked ? '#eb3b5a' : '#d1d8e0'} onClick={handleLockingRoom}>
              {room.isLocked ? <BsLockFill color='#eee' size={24} /> : <BsUnlockFill size={24} />}
            </Button>
          }
          <Button color={streamOptions.audio ? '#20bf6b' : '#d1d8e0'} onClick={handleAudioTrack}>
            {streamOptions.audio ? <FaVolumeUp size={24} /> : <FaVolumeMute size={24}/>}
          </Button>
          <Button color={streamOptions.video ? '#20bf6b' : '#d1d8e0'} onClick={handleVideoTrack}>
            {streamOptions.video ? <FaVideo size={24} /> : <FaVideoSlash size={24} />}
          </Button>
          <IoIosExit onClick={() => history.push('/')} size={42} cursor='pointer' color='#eb3b5a' />
        </div>
      </UtilityBox>
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
    background-color: #A9C9FF;
    background-image: linear-gradient(180deg, #A9C9FF 0%, #FFBBEC 100%);
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
  socket: PropTypes.object,
  room: PropTypes.object,
  chatList: PropTypes.array,
  joinRoom: PropTypes.func.isRequired,
  leaveRoom: PropTypes.func.isRequired,
  addMember: PropTypes.func.isRequired,
  deleteMember: PropTypes.func.isRequired,
  addChat: PropTypes.func.isRequired,
  updateRoomLockingStatus: PropTypes.func.isRequired,
};
