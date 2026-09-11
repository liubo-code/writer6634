import React from 'react';
import ReactDOM from 'react-dom/client';
import Board from '@/components/board';
import '@/app/globals.css';
import '@/app/mobile.css';

function DesktopApp(){
  return <Board ownerKey="desktop-local"/>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DesktopApp/>
  </React.StrictMode>,
);
