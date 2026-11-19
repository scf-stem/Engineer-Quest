import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HostedQuest } from './integration/IntegratedQuestApp.jsx';
import './workshop.css';

function Workshop() {
  const [key, setKey] = useState(null);
  const [message, setMessage] = useState('正在读取你的工程工位…');

  useEffect(() => {
    let generation = 0;
    let openedKey = null;
    async function verify() {
      const attempt = ++generation;
      try {
        const response = await fetch('/api/quest/v1/learning?form=4', { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok || !result.success) throw Error(result.error || '无法读取体验记录。');
        if (attempt !== generation) return;
        if (openedKey && result.data.workspace_key !== openedKey) throw Error('当前浏览器已切换体验。请返回体验页重新进入。');
        openedKey = result.data.workspace_key;
        setKey(result.data.workspace_key);
        setMessage('请先在体验页提交课前问卷。');
      } catch (error) {
        if (attempt !== generation) return;
        setKey(null);
        setMessage(error.message || '无法读取体验记录。');
      }
    }
    function verifyVisible() { if (!document.hidden) void verify(); }
    void verify();
    document.addEventListener('visibilitychange', verifyVisible);
    window.addEventListener('pageshow', verifyVisible);
    return () => {
      generation++;
      document.removeEventListener('visibilitychange', verifyVisible);
      window.removeEventListener('pageshow', verifyVisible);
    };
  }, []);

  return <>
    <nav className="quest-experience-nav" aria-label="我的体验">
      <a href="/experience.html">返回我的体验</a>
      {key && <a href="/experience.html?phase=post">填写课后问卷</a>}
    </nav>
    {key ? <HostedQuest workspaceKey={key} /> : <p className="quest-workshop-status" role="status">{message}</p>}
  </>;
}

createRoot(document.getElementById('root')).render(<Workshop />);
