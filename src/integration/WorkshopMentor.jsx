import React from 'react';
import './experience-refinement.css';

/** In-place scripted coaching; it only displays facts and requests navigation. */
export function WorkshopMentor({children,title='林工 · 一起看眼前这一步',onManual,section}){
  return <aside className="eq-workshop-mentor" aria-label="林工的现场引导"><img src="/art/npc-tutorial/lin-mentor-v2.webp" alt="林工"/><div><p className="eq-game-kicker">{title}</p><div className="eq-mentor-speech">{children}</div>{onManual&&section&&<button type="button" onClick={()=>onManual(section)}>和林工查手册 §{section} ↗</button>}</div></aside>;
}
