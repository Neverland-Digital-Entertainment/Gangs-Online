'use client';

import { useState, useRef, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Position } from '../constants/types';

interface MapPositionPickerProps {
  value: Position;
  onChange: (position: Position) => void;
  mapImageUrl?: string;
}

const MapPositionPicker = ({
  value,
  onChange,
  mapImageUrl = '/placeholder-map.png',
}: MapPositionPickerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mapDimensions, setMapDimensions] = useState({ width: 100, height: 100 });

  // Initialize canvas and draw map
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 600;
    canvas.height = 600;

    // Draw background grid
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;

    const gridSize = 50;
    for (let x = 0; x <= canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    for (let y = 0; y <= canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw center lines
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    // Draw axis labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px sans-serif';
    ctx.fillText('X', canvas.width - 20, canvas.height / 2 - 10);
    ctx.fillText('Z', canvas.width / 2 + 10, 20);

    // Try to load and draw map image
    const img = new Image();
    img.onload = () => {
      ctx.globalAlpha = 0.5;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1.0;
      drawMarker(ctx, canvas);
    };
    img.onerror = () => {
      // If image fails to load, just draw the marker
      drawMarker(ctx, canvas);
    };
    img.src = mapImageUrl;
  }, [mapImageUrl]);

  // Redraw marker when position changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Redraw everything (in a real app, you'd cache the background)
    drawMarker(ctx, canvas);
  }, [value]);

  const drawMarker = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    // Convert world coordinates to canvas coordinates
    const canvasX = (value.x / mapDimensions.width) * canvas.width + canvas.width / 2;
    const canvasY = canvas.height / 2 - (value.z / mapDimensions.height) * canvas.height;

    // Draw marker
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(canvasX, canvasY, 8, 0, Math.PI * 2);
    ctx.fill();

    // Draw marker outline
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw coordinates text
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 12px sans-serif';
    const text = `(${value.x.toFixed(1)}, ${value.z.toFixed(1)})`;
    const textMetrics = ctx.measureText(text);
    const textX = canvasX - textMetrics.width / 2;
    const textY = canvasY - 15;

    // Draw text background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(textX - 4, textY - 12, textMetrics.width + 8, 16);

    // Draw text
    ctx.fillStyle = '#1f2937';
    ctx.fillText(text, textX, textY);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    // Convert canvas coordinates to world coordinates
    const worldX = ((canvasX - canvas.width / 2) / canvas.width) * mapDimensions.width;
    const worldZ = ((canvas.height / 2 - canvasY) / canvas.height) * mapDimensions.height;

    onChange({
      x: Math.round(worldX * 10) / 10,
      z: Math.round(worldZ * 10) / 10,
    });
  };

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    handleCanvasClick(e);
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <MapPin className="h-4 w-4" />
            <span>點擊地圖選擇位置</span>
          </div>
          <div className="relative border rounded-lg overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full cursor-crosshair"
              onClick={handleCanvasClick}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseUp}
            />
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            當前座標: X = {value.x.toFixed(1)}, Z = {value.z.toFixed(1)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MapPositionPicker;
