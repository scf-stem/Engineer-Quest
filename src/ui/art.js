const artUrl = file => `${import.meta.env.BASE_URL}art/${file}`;

export const OFFICE_ART = artUrl('eq-office-style-v1.jpg');
export const STUDIO_SCENE_ART = artUrl('eq-studio-exploration-v1.webp');
export const EXPLORATION_ART = {src: STUDIO_SCENE_ART, width: 1672, height: 941, alt: '暮色中的原创研发室，左侧邮箱、中央工具箱与右侧林工形成三处探索区域', caption: '研发室探索场景 / 互动标记与所有文字由网页绘制'};

// Narrative assets only. Never use these objects as hardware or curriculum truth.
export const FIRST_ORDER_ART = {
  customerScene: {
    src: artUrl('eq-reading-corner-v1.webp'),
    width: 1672, height: 941,
    alt: '傍晚的校园阅读角，窗边桌面渐暗，桌灯尚未亮起',
    caption: '客户现场 / 校园阅读角 · 剧情示意',
  },
  starterKit: {
    src: artUrl('eq-parts-tray-v1.webp'),
    width: 1536, height: 1024,
    alt: '分格收纳盘里的通用开发板、LED、传感器、电阻和未连接的跳线',
    caption: '首单元件托盘 · 氛围插画，器件规格以手册为准',
  },
  mentor: {
    src: artUrl('eq-lin-portrait-v1.webp'),
    width: 1175, height: 1338,
    alt: '林工：戴圆眼镜、穿绿色工装，抱着笔记本的原创工程师角色',
    caption: '林工 / 需求负责人 · 原创角色',
  },
};
