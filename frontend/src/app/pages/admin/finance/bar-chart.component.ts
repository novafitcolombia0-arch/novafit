import { Component, Input, OnChanges } from '@angular/core';

export interface ChartSeries {
  name: string;
  color: string;
  values: number[];
}

interface Bar { x: number; y: number; w: number; h: number; color: string; }

/**
 * Gráfica de barras en SVG (sin librerías): una o dos series agrupadas, valores
 * negativos por debajo de la línea base y tooltip al pasar el mouse por cada periodo.
 */
@Component({
  selector: 'app-bar-chart',
  standalone: true,
  template: `
    <div class="relative">
      @if (series.length > 1) {
        <div class="flex gap-4 text-xs text-[#52514e] mb-2">
          @for (s of series; track s.name) {
            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm" [style.background]="s.color"></span>{{ s.name }}</span>
          }
        </div>
      }
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" class="w-full h-auto block" role="img" [attr.aria-label]="ariaLabel">
        <!-- cuadrícula -->
        @for (t of ticks; track t.value) {
          <line [attr.x1]="padL" [attr.x2]="W - padR" [attr.y1]="t.y" [attr.y2]="t.y"
                [attr.stroke]="t.value === 0 ? '#9a9993' : '#ebeae6'" stroke-width="1" />
          <text [attr.x]="padL - 6" [attr.y]="t.y + 3" text-anchor="end" font-size="10" fill="#6f6e69">{{ short(t.value) }}</text>
        }
        <!-- barras -->
        @for (b of bars; track $index) {
          <path [attr.d]="barPath(b)" [attr.fill]="b.color" />
        }
        <!-- etiquetas eje x -->
        @for (l of xLabels; track $index) {
          <text [attr.x]="l.x" [attr.y]="H - 6" text-anchor="middle" font-size="10" fill="#6f6e69">{{ l.text }}</text>
        }
        <!-- zonas de hover (más grandes que la barra) -->
        @for (label of labels; track $index) {
          <rect [attr.x]="padL + $index * slot" [attr.y]="padT" [attr.width]="slot" [attr.height]="plotH"
                [attr.fill]="hover === $index ? 'rgba(0,0,0,0.04)' : 'transparent'"
                (mouseenter)="hover = $index" (mouseleave)="hover = null" />
        }
      </svg>
      @if (hover !== null) {
        <div class="absolute pointer-events-none bg-white border border-[#e6e6e6] shadow-sm rounded px-3 py-2 text-xs z-10 whitespace-nowrap"
             [style.left.%]="tooltipLeft()" [style.top.px]="0" [style.transform]="'translateX(-50%)'">
          <p class="font-semibold text-[#0b0b0b] mb-1">{{ tooltipLabels[hover] || labels[hover] }}</p>
          @for (s of series; track s.name) {
            <p class="flex items-center gap-1.5 text-[#52514e]">
              <span class="w-2 h-2 rounded-sm" [style.background]="s.color"></span>
              {{ s.name }}: <span class="text-[#0b0b0b] font-medium">{{ money(s.values[hover]) }}</span>
            </p>
          }
        </div>
      }
    </div>
  `,
})
export class BarChartComponent implements OnChanges {
  @Input() labels: string[] = [];
  @Input() tooltipLabels: string[] = [];
  @Input() series: ChartSeries[] = [];
  @Input() ariaLabel = 'Gráfica';

  readonly W = 720;
  readonly H = 240;
  readonly padL = 56;
  readonly padR = 8;
  readonly padT = 10;
  readonly padB = 24;
  plotH = this.H - this.padT - this.padB;
  slot = 0;
  bars: Bar[] = [];
  ticks: { value: number; y: number }[] = [];
  xLabels: { x: number; text: string }[] = [];
  hover: number | null = null;
  private zeroY = 0;

  ngOnChanges() {
    const count = this.labels.length;
    const plotW = this.W - this.padL - this.padR;
    this.slot = count ? plotW / count : plotW;

    const all = this.series.flatMap(s => s.values);
    const rawMax = Math.max(0, ...all);
    const rawMin = Math.min(0, ...all);
    const step = this.niceStep((rawMax - rawMin) / 4 || 1);
    const max = Math.ceil(rawMax / step) * step || step;
    const min = Math.floor(rawMin / step) * step;
    const y = (v: number) => this.padT + ((max - v) / (max - min)) * this.plotH;
    this.zeroY = y(0);

    this.ticks = [];
    for (let v = min; v <= max + step / 2; v += step) this.ticks.push({ value: v, y: y(v) });

    // Ancho de barra: el grupo ocupa ~70% del espacio, con 2px entre barras del grupo
    const groupW = Math.min(this.slot * 0.7, 48);
    const gap = this.series.length > 1 ? 2 : 0;
    const barW = Math.max(1, (groupW - gap * (this.series.length - 1)) / Math.max(1, this.series.length));
    this.bars = [];
    this.labels.forEach((_, i) => {
      const start = this.padL + i * this.slot + (this.slot - groupW) / 2;
      this.series.forEach((s, j) => {
        const v = s.values[i] || 0;
        if (!v) return;
        const top = Math.min(y(v), this.zeroY);
        this.bars.push({ x: start + j * (barW + gap), y: top, w: barW, h: Math.abs(y(v) - this.zeroY), color: s.color });
      });
    });

    // Etiquetas del eje x sin amontonarse
    const every = Math.max(1, Math.ceil(count / 12));
    this.xLabels = this.labels
      .map((text, i) => ({ x: this.padL + i * this.slot + this.slot / 2, text, i }))
      .filter(l => l.i % every === 0);
  }

  /** Barra con las esquinas del extremo de datos redondeadas (4px) y la base recta */
  barPath(b: Bar): string {
    const r = Math.min(4, b.w / 2, b.h);
    const up = b.y < this.zeroY; // barra positiva: redondeada arriba
    if (up) {
      return `M${b.x},${b.y + b.h} V${b.y + r} Q${b.x},${b.y} ${b.x + r},${b.y} H${b.x + b.w - r} Q${b.x + b.w},${b.y} ${b.x + b.w},${b.y + r} V${b.y + b.h} Z`;
    }
    const bottom = b.y + b.h;
    return `M${b.x},${b.y} V${bottom - r} Q${b.x},${bottom} ${b.x + r},${bottom} H${b.x + b.w - r} Q${b.x + b.w},${bottom} ${b.x + b.w},${bottom - r} V${b.y} Z`;
  }

  tooltipLeft(): number {
    if (this.hover === null) return 0;
    const x = this.padL + this.hover * this.slot + this.slot / 2;
    return Math.min(85, Math.max(15, (x / this.W) * 100));
  }

  private niceStep(raw: number): number {
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / pow;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
  }

  short(v: number): string {
    const a = Math.abs(v);
    if (a >= 1_000_000) return `${+(v / 1_000_000).toFixed(1)} M`;
    if (a >= 1_000) return `${+(v / 1_000).toFixed(0)} mil`;
    return String(v);
  }

  money(v: number): string {
    return '$' + Math.round(v || 0).toLocaleString('es-CO');
  }
}
