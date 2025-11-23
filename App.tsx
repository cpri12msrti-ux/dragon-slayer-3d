import React, { useState, useEffect, useRef } from 'react';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from './constants';
import DoomEngine from './components/DoomEngine';
import { GameState } from './types';

const App: React.FC = () => {
  return (
    <div className="w-full h-screen bg-black flex items-center justify-center overflow-hidden relative">
       <DoomEngine />
    </div>
  );
};

export default App;