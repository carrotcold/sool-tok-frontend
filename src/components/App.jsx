import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Switch, Route, Redirect } from 'react-router-dom';

import MyPageContainer from '../containers/MyPageContainer';
import LobbyContainer from '../containers/LobbyContainer';
import RoomContainer from '../containers/RoomContainer';
import FloatingButton from './FloatingButton';
import Login from './Login';

function App({ onLogin, onLoad, user }) {
  const [isOpenedMyPage, setOpenMyPage] = useState(false);

  useEffect(() => {
    onLoad();
  }, []);

  useEffect(() => {
    if (!user) {
      setOpenMyPage(false);
    }
  }, [user]);

  return (
    <>
      { user && isOpenedMyPage && <MyPageContainer /> }
      { user && <FloatingButton onClick={() => { setOpenMyPage(!isOpenedMyPage); }} text='나' />}
      <Switch>
        <Route exact path='/'>
          {user ? <LobbyContainer /> : <Login onLogin={onLogin} />}
        </Route>
        <Route path='/rooms/:room_id'>
          <RoomContainer />
        </Route>
        <Redirect to='/' />
      </Switch>
    </>
  );
}

export default App;

App.propTypes = {
  onLogin: PropTypes.func.isRequired,
  onLoad: PropTypes.func.isRequired,
  user: PropTypes.oneOfType([
    PropTypes.oneOf([null]),
    PropTypes.object,
  ]),
};
