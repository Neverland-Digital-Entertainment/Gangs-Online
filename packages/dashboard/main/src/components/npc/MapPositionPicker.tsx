'use client';

import { useState, useRef, useEffect } from 'react';
import { MapPin, ZoomIn, ZoomOut, Move, Target } from 'lucide-react';

interface Position {
  x: number;
  z: number;
}

interface MapPositionPickerProps {
  initialPosition?: Position;
  initialRotation?: number;
  onPositionChange: (position: Position, rotation: number) => void;
  gridSize?: number;
  mapWidth?: number;
  mapHeight?: number;
}

export default function MapPositionPicker({
  initialPosition = { x: 0, z: 0 },
  initialRotation = 0,
  onPositionChange,
  gridSize = 1,
  mapWidth = 100,
  mapHeight = 100,
}: MapPositionPickerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [position, setPosition] = useState<Position>(initialPosition);
  const [rotation, setRotation] = useState(initialRotation);
  const [zoom, setZoom] = useState(5);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    drawCanvas();
  }, [position, rotation, zoom, offset]);

  function drawCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate scale
    const scale = zoom;
    const centerX = canvas.width / 2 + offset.x;
    const centerY = canvas.height / 2 + offset.y;

    // Draw grid
    ctx.strokeStyle = 'var(--border-color, #e5e7eb)';
    ctx.lineWidth = 1;

    const gridSpacing = gridSize * scale;
    const startX = Math.floor(-centerX / gridSpacing) * gridSpacing;
    const startY = Math.floor(-centerY / gridSpacing) * gridSpacing;

    // Vertical lines
    for (let x = startX; x < canvas.width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x + centerX, 0);
      ctx.lineTo(x + centerX, canvas.height);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = startY; y < canvas.height; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y + centerY);
      ctx.lineTo(canvas.width, y + centerY);
      ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 2;

    // X axis (red)
    ctx.strokeStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(canvas.width, centerY);
    ctx.stroke();

    // Z axis (blue)
    ctx.strokeStyle = '#3b82f6';
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, canvas.height);
    ctx.stroke();

    // Draw position marker
    const markerX = centerX + position.x * scale;
    const markerY = centerY - position.z * scale; // Negative because canvas Y is inverted

    // Draw rotation indicator
    const arrowLength = 20;
    const radians = (rotation * Math.PI) / 180;
    const arrowEndX = markerX + Math.sin(radians) * arrowLength;
    const arrowEndY = markerY - Math.cos(radians) * arrowLength;

    // Draw circle
    ctx.fillStyle = '#10b981';
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(markerX, markerY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Draw rotation arrow
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(markerX, markerY);
    ctx.lineTo(arrowEndX, arrowEndY);
    ctx.stroke();

    // Draw arrowhead
    const arrowHeadLength = 8;
    const angle1 = radians + Math.PI / 6;
    const angle2 = radians - Math.PI / 6;
    ctx.beginPath();
    ctx.moveTo(arrowEndX, arrowEndY);
    ctx.lineTo(
      arrowEndX - Math.sin(angle1) * arrowHeadLength,
      arrowEndY + Math.cos(angle1) * arrowHeadLength
    );
    ctx.moveTo(arrowEndX, arrowEndY);
    ctx.lineTo(
      arrowEndX - Math.sin(angle2) * arrowHeadLength,
      arrowEndY + Math.cos(angle2) * arrowHeadLength
    );
    ctx.stroke();

    // Draw coordinates
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px monospace';
    ctx.fillText(`(${position.x.toFixed(1)}, ${position.z.toFixed(1)})`, markerX + 12, markerY - 12);
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const centerX = canvas.width / 2 + offset.x;
    const centerY = canvas.height / 2 + offset.y;

    const worldX = (clickX - centerX) / zoom;
    const worldZ = -(clickY - centerY) / zoom; // Negative because canvas Y is inverted

    // Snap to grid
    const snappedX = Math.round(worldX / gridSize) * gridSize;
    const snappedZ = Math.round(worldZ / gridSize) * gridSize;

    setPosition({ x: snappedX, z: snappedZ });
    onPositionChange({ x: snappedX, z: snappedZ }, rotation);
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (e.button === 1 || e.button === 2) {
      // Middle or right mouse button
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  function handleZoomIn() {
    setZoom(Math.min(zoom + 1, 20));
  }

  function handleZoomOut() {
    setZoom(Math.max(zoom - 1, 1));
  }

  function handleRotationChange(delta: number) {
    const newRotation = (rotation + delta + 360) % 360;
    setRotation(newRotation);
    onPositionChange(position, newRotation);
  }

  function handleResetView() {
    setOffset({ x: 0, y: 0 });
    setZoom(5);
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleZoomOut}
            className="btn btn-sm btn-outline"
            title="縮小"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-sm text-[var(--muted-foreground)] min-w-[60px] text-center">
            {zoom}x
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            className="btn btn-sm btn-outline"
            title="放大"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleResetView}
            className="btn btn-sm btn-outline ml-2"
            title="重置視圖"
          >
            <Move className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--muted-foreground)]">旋轉:</span>
          <button
            type="button"
            onClick={() => handleRotationChange(-15)}
            className="btn btn-sm btn-outline"
          >
            -15°
          </button>
          <span className="text-sm font-mono min-w-[50px] text-center">
            {rotation}°
          </span>
          <button
            type="button"
            onClick={() => handleRotationChange(15)}
            className="btn btn-sm btn-outline"
          >
            +15°
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative border rounded-lg overflow-hidden bg-white dark:bg-gray-900">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="cursor-crosshair"
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      {/* Instructions */}
      <div className="card bg-blue-50 dark:bg-blue-900/20">
        <div className="card-body">
          <div className="flex items-start gap-3">
            <Target className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="text-blue-900 dark:text-blue-100">
                <strong>操作說明:</strong>
              </p>
              <ul className="list-disc list-inside text-blue-700 dark:text-blue-300 space-y-1">
                <li>點擊地圖設定 NPC 位置</li>
                <li>使用滑鼠中鍵或右鍵拖曳移動視圖</li>
                <li>使用縮放按鈕調整視圖大小</li>
                <li>綠色圓點表示當前位置，箭頭表示朝向</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Position Info */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card">
          <div className="card-body text-center">
            <MapPin className="w-6 h-6 text-[var(--muted-foreground)] mx-auto mb-2" />
            <p className="text-sm text-[var(--muted-foreground)] mb-1">X 座標</p>
            <p className="text-lg font-semibold font-mono">{position.x.toFixed(1)}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center">
            <MapPin className="w-6 h-6 text-[var(--muted-foreground)] mx-auto mb-2" />
            <p className="text-sm text-[var(--muted-foreground)] mb-1">Z 座標</p>
            <p className="text-lg font-semibold font-mono">{position.z.toFixed(1)}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center">
            <Target className="w-6 h-6 text-[var(--muted-foreground)] mx-auto mb-2" />
            <p className="text-sm text-[var(--muted-foreground)] mb-1">旋轉角度</p>
            <p className="text-lg font-semibold font-mono">{rotation}°</p>
          </div>
        </div>
      </div>
    </div>
  );
}
