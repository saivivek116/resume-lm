import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { CoverLetterDocumentSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, LayoutTemplate } from "lucide-react";
import { DEFAULT_COVER_LETTER_SETTINGS } from "./cover-letter-pdf-document";

interface CoverLetterSettingsFormProps {
  settings: CoverLetterDocumentSettings;
  onChange: (settings: CoverLetterDocumentSettings) => void;
}

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
}

function NumberInput({ value, onChange, min, max, step }: NumberInputProps) {
  const increment = () => {
    const newValue = Math.min(max, value + step);
    onChange(Number(newValue.toFixed(2)));
  };

  const decrement = () => {
    const newValue = Math.max(min, value - step);
    onChange(Number(newValue.toFixed(2)));
  };

  const displayValue = Number(value.toFixed(2));

  return (
    <div className="flex items-center space-x-1">
      <span className="text-xs text-muted-foreground/60 w-8">{displayValue}</span>
      <div className="flex flex-col">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-4 w-4 hover:bg-slate-100"
          onClick={increment}
        >
          <ChevronUp className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-4 w-4 hover:bg-slate-100"
          onClick={decrement}
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

const COMPACT_SETTINGS: CoverLetterDocumentSettings = {
  font_size: 10,
  line_height: 1.3,
  margin_vertical: 54,
  margin_horizontal: 54,
  header_name_size: 20,
  paragraph_spacing: 8,
};

export function CoverLetterSettingsForm({ settings, onChange }: CoverLetterSettingsFormProps) {
  const handleChange = (field: keyof CoverLetterDocumentSettings, value: number) => {
    onChange({ ...settings, [field]: value });
  };

  return (
    <div className="space-y-6">
      {/* Presets */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange({ ...DEFAULT_COVER_LETTER_SETTINGS })}
          className="relative h-20 group p-0 overflow-hidden border-slate-200 hover:border-emerald-600/40 transition-colors"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-teal-50/50 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative h-full w-full flex flex-col items-center">
            <div className="w-full p-1.5 text-xs font-medium text-emerald-600 border-b border-slate-200 bg-slate-50/80">
              <LayoutTemplate className="w-3 h-3 inline-block mr-1" />
              Default
            </div>
            <div className="flex-1 w-full p-2 flex flex-col justify-center">
              <div className="space-y-1.5">
                <div className="w-3/4 h-1 bg-slate-300 rounded mx-auto" />
                <div className="w-full h-0.5 bg-slate-200 rounded" />
                <div className="w-11/12 h-0.5 bg-slate-200 rounded" />
              </div>
            </div>
          </div>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange({ ...COMPACT_SETTINGS })}
          className="relative h-20 group p-0 overflow-hidden border-slate-200 hover:border-pink-600/40 transition-colors"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-pink-50/50 to-rose-50/50 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative h-full w-full flex flex-col items-center">
            <div className="w-full p-1.5 text-xs font-medium text-pink-600 border-b border-slate-200 bg-slate-50/80">
              <LayoutTemplate className="w-3 h-3 inline-block mr-1" />
              Compact
            </div>
            <div className="flex-1 w-full p-2 flex flex-col justify-center">
              <div className="space-y-1">
                <div className="w-2/3 h-1 bg-slate-300 rounded mx-auto" />
                <div className="w-full h-0.5 bg-slate-200 rounded" />
                <div className="w-11/12 h-0.5 bg-slate-200 rounded" />
                <div className="w-10/12 h-0.5 bg-slate-200 rounded" />
              </div>
            </div>
          </div>
        </Button>
      </div>

      {/* Settings Sliders */}
      <div className="space-y-4 bg-slate-50/50 rounded-lg p-4 border border-slate-200/50">
        {/* Font Size */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-muted-foreground">Font Size</Label>
            <div className="flex items-center">
              <NumberInput
                value={settings.font_size}
                min={9}
                max={13}
                step={0.5}
                onChange={(v) => handleChange('font_size', v)}
              />
              <span className="text-xs text-muted-foreground/60 ml-1">pt</span>
            </div>
          </div>
          <Slider
            value={[settings.font_size]}
            min={9}
            max={13}
            step={0.5}
            onValueChange={([v]) => handleChange('font_size', v)}
          />
        </div>

        {/* Line Height */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-muted-foreground">Line Height</Label>
            <div className="flex items-center">
              <NumberInput
                value={settings.line_height}
                min={1}
                max={2}
                step={0.1}
                onChange={(v) => handleChange('line_height', v)}
              />
              <span className="text-xs text-muted-foreground/60 ml-1">x</span>
            </div>
          </div>
          <Slider
            value={[settings.line_height]}
            min={1}
            max={2}
            step={0.1}
            onValueChange={([v]) => handleChange('line_height', v)}
          />
        </div>

        {/* Vertical Margins */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-muted-foreground">Vertical Margins</Label>
            <div className="flex items-center">
              <NumberInput
                value={settings.margin_vertical}
                min={36}
                max={108}
                step={2}
                onChange={(v) => handleChange('margin_vertical', v)}
              />
              <span className="text-xs text-muted-foreground/60 ml-1">pt</span>
            </div>
          </div>
          <Slider
            value={[settings.margin_vertical]}
            min={36}
            max={108}
            step={2}
            onValueChange={([v]) => handleChange('margin_vertical', v)}
          />
        </div>

        {/* Horizontal Margins */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-muted-foreground">Horizontal Margins</Label>
            <div className="flex items-center">
              <NumberInput
                value={settings.margin_horizontal}
                min={36}
                max={108}
                step={2}
                onChange={(v) => handleChange('margin_horizontal', v)}
              />
              <span className="text-xs text-muted-foreground/60 ml-1">pt</span>
            </div>
          </div>
          <Slider
            value={[settings.margin_horizontal]}
            min={36}
            max={108}
            step={2}
            onValueChange={([v]) => handleChange('margin_horizontal', v)}
          />
        </div>

        {/* Header Name Size */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-muted-foreground">Header Name Size</Label>
            <div className="flex items-center">
              <NumberInput
                value={settings.header_name_size}
                min={14}
                max={36}
                step={1}
                onChange={(v) => handleChange('header_name_size', v)}
              />
              <span className="text-xs text-muted-foreground/60 ml-1">pt</span>
            </div>
          </div>
          <Slider
            value={[settings.header_name_size]}
            min={14}
            max={36}
            step={1}
            onValueChange={([v]) => handleChange('header_name_size', v)}
          />
        </div>

        {/* Paragraph Spacing */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-muted-foreground">Paragraph Spacing</Label>
            <div className="flex items-center">
              <NumberInput
                value={settings.paragraph_spacing}
                min={4}
                max={24}
                step={2}
                onChange={(v) => handleChange('paragraph_spacing', v)}
              />
              <span className="text-xs text-muted-foreground/60 ml-1">pt</span>
            </div>
          </div>
          <Slider
            value={[settings.paragraph_spacing]}
            min={4}
            max={24}
            step={2}
            onValueChange={([v]) => handleChange('paragraph_spacing', v)}
          />
        </div>
      </div>
    </div>
  );
}
