import { useEffect, useRef } from 'react';
import { useRQ } from './useRQ';
import { controller } from '@/game/controller';
import { Hud } from './Hud';
import { GlitchMenu } from './GlitchMenu';
import { EditorPanel } from './EditorPanel';
import { TitleScreen } from './TitleScreen';
import { HowToPlay } from './HowToPlay';
import { WorldsScreen } from './WorldsScreen';
import { EditorPickScreen } from './EditorPickScreen';
import { Overlays } from './Overlays';

export function GamePage() {
  const ctl = useRQ();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    controller.attach(canvas);

    const kd = (e: KeyboardEvent) => controller.handleKeyDown(e);
    const ku = (e: KeyboardEvent) => controller.handleKeyUp(e);
    const md = (e: MouseEvent) => controller.handleMouseDown(e, canvas);
    const mm = (e: MouseEvent) => controller.handleMouseMove(e, canvas);
    const mu = (e: MouseEvent) => controller.handleMouseUp(e, canvas);
    const cm = (e: Event) => e.preventDefault();
    const blur = () => controller.clearKeys();

    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);
    canvas.addEventListener('mousedown', md);
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
    canvas.addEventListener('contextmenu', cm);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur);
      canvas.removeEventListener('mousedown', md);
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', mu);
      canvas.removeEventListener('contextmenu', cm);
    };
  }, []);

  const inEditor = !!ctl.engine?.editorMode;

  return (
    <div className="relative w-screen h-screen bg-[#04140b] overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        width={1024}
        height={576}
        className="absolute inset-0 w-full h-full object-contain pixelated"
      />
      {ctl.screen === 'game' && <Hud />}
      {ctl.screen === 'game' && inEditor && <EditorPanel />}
      {ctl.screen === 'game' && <Overlays />}
      {ctl.screen === 'game' && ctl.overlay === 'glitch' && <GlitchMenu />}
      {ctl.screen === 'title' && <TitleScreen />}
      {ctl.screen === 'howto' && <HowToPlay />}
      {ctl.screen === 'worlds' && <WorldsScreen />}
      {ctl.screen === 'editorPick' && <EditorPickScreen />}
    </div>
  );
}
