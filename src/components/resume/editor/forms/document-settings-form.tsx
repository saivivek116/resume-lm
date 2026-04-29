import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  DocumentSettings,
  DEFAULT_DOCUMENT_SETTINGS,
  COMPACT_DOCUMENT_SETTINGS,
  ResumeSectionId,
  DEFAULT_SECTION_ORDER,
  SECTION_LABELS,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown } from "lucide-react"
import { Switch } from "@/components/ui/switch";
import { SavedStylesDialog } from "./saved-styles-dialog";
import { LayoutTemplate, RotateCcw } from "lucide-react";

interface DocumentSettingsFormProps {
  documentSettings: DocumentSettings;
  onChange: (field: 'document_settings', value: DocumentSettings) => void;
  profileDefaults?: DocumentSettings;
  showSavedStyles?: boolean;
  sectionOrder?: ResumeSectionId[];
  onSectionOrderChange?: (order: ResumeSectionId[]) => void;
  profileSectionOrderDefault?: ResumeSectionId[];
}

interface NumberInputProps {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step: number
}

function NumberInput({ value, onChange, min, max, step }: NumberInputProps) {
  const increment = () => {
    const newValue = Math.min(max, value + step)
    onChange(Number(newValue.toFixed(2)))
  }

  const decrement = () => {
    const newValue = Math.max(min, value - step)
    onChange(Number(newValue.toFixed(2)))
  }

  const displayValue = Number(value.toFixed(2))

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
  )
}

export function DocumentSettingsForm({
  documentSettings,
  onChange,
  profileDefaults,
  showSavedStyles = true,
  sectionOrder,
  onSectionOrderChange,
  profileSectionOrderDefault,
}: DocumentSettingsFormProps) {

  const reorderEnabled = !!onSectionOrderChange;
  const effectiveOrder: ResumeSectionId[] = (() => {
    const base = sectionOrder && sectionOrder.length > 0 ? sectionOrder : DEFAULT_SECTION_ORDER;
    const seen = new Set<ResumeSectionId>();
    const filtered: ResumeSectionId[] = [];
    base.forEach((id) => {
      if (!seen.has(id) && DEFAULT_SECTION_ORDER.includes(id)) {
        seen.add(id);
        filtered.push(id);
      }
    });
    DEFAULT_SECTION_ORDER.forEach((id) => {
      if (!seen.has(id)) filtered.push(id);
    });
    return filtered;
  })();

  const moveSection = (index: number, direction: -1 | 1) => {
    if (!onSectionOrderChange) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= effectiveOrder.length) return;
    const updated = [...effectiveOrder];
    const [item] = updated.splice(index, 1);
    updated.splice(newIndex, 0, item);
    onSectionOrderChange(updated);
  };


  // Initialize document_settings if it doesn't exist
  if (!documentSettings) {
    onChange('document_settings', DEFAULT_DOCUMENT_SETTINGS);
    return null; // Return null while initializing to prevent errors
  }

  const handleSettingsChange = (newSettings: DocumentSettings) => {

    onChange('document_settings', newSettings);
  };

  const handleFontSizeChange = (value: number) => {
    const newSettings: DocumentSettings = {
      ...documentSettings, // Don't spread defaultSettings here
      document_font_size: value
    };
    handleSettingsChange(newSettings);
  };



  const SectionSettings = ({ title, section }: { title: string; section: 'skills' | 'experience' | 'projects' | 'education' }) => (
    <div className="space-y-4 bg-slate-50/50 rounded-lg border border-slate-200/50">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-muted-foreground">Space Above {title} Section</Label>
          <div className="flex items-center">
            <NumberInput
              value={documentSettings?.[`${section}_margin_top`] ?? 2}
              min={0}
              max={48}
              step={1}
              onChange={(value) => 
                handleSettingsChange({
                  ...documentSettings,
                  [`${section}_margin_top`]: value
                })
              }
            />
            <span className="text-xs text-muted-foreground/60 ml-1">pt</span>
          </div>
        </div>
        <Slider
          value={[Number(documentSettings?.[`${section}_margin_top`] ?? 2)]}
          min={0}
          max={48}
          step={1}
          onValueChange={([value]) => 
            handleSettingsChange({
              ...documentSettings,
              [`${section}_margin_top`]: value
            })
          }
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-muted-foreground">Space Below {title} Section</Label>
          <div className="flex items-center">
            <NumberInput
              value={documentSettings?.[`${section}_margin_bottom`] ?? 2}
              min={0}
              max={48}
              step={1}
              onChange={(value) => 
                handleSettingsChange({
                  ...documentSettings,
                  [`${section}_margin_bottom`]: value
                })
              }
            />
            <span className="text-xs text-muted-foreground/60 ml-1">pt</span>
          </div>
        </div>
        <Slider
          value={[Number(documentSettings?.[`${section}_margin_bottom`] ?? 2)]}
          min={0}
          max={48}
          step={1}
          onValueChange={([value]) => 
            handleSettingsChange({
              ...documentSettings,
              [`${section}_margin_bottom`]: value
            })
          }
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-muted-foreground">Horizontal Margins</Label>
          <div className="flex items-center">
            <NumberInput
              value={documentSettings?.[`${section}_margin_horizontal`] ?? 0}
              min={0}
              max={72}
              step={2}
              onChange={(value) => 
                handleSettingsChange({
                  ...documentSettings,
                  [`${section}_margin_horizontal`]: value
                })
              }
            />
            <span className="text-xs text-muted-foreground/60 ml-1">pt</span>
          </div>
        </div>
        <Slider
          value={[Number(documentSettings?.[`${section}_margin_horizontal`] ?? 0)]}
          min={0}
          max={72}
          step={2}
          onValueChange={([value]) => 
            handleSettingsChange({
              ...documentSettings,
              [`${section}_margin_horizontal`]: value
            })
          }
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-muted-foreground">Space Between Items</Label>
          <div className="flex items-center">
            <NumberInput
              value={documentSettings?.[`${section}_item_spacing`] ?? 4}
              min={0}
              max={16}
              step={0.5}
              onChange={(value) => 
                handleSettingsChange({
                  ...documentSettings,
                  [`${section}_item_spacing`]: value
                })
              }
            />
            <span className="text-xs text-muted-foreground/60 ml-1">pt</span>
          </div>
        </div>
        <Slider
          value={[Number(documentSettings?.[`${section}_item_spacing`] ?? 4)]}
          min={0}
          max={16}
          step={0.5}
          onValueChange={([value]) => 
            handleSettingsChange({
              ...documentSettings,
              [`${section}_item_spacing`]: value
            })
          }
        />
      </div>
    </div>
  );

  return (
    <div className="">
        <Card className="">

        {/* Buttons */}
        <CardHeader className="flex flex-col space-y-4">
          {showSavedStyles && (
            <div className="flex items-center space-x-2 w-full">
              <SavedStylesDialog
                currentSettings={documentSettings || DEFAULT_DOCUMENT_SETTINGS}
                onApplyStyle={(settings) => handleSettingsChange(settings)}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSettingsChange({...DEFAULT_DOCUMENT_SETTINGS})}
              className="relative h-60 group p-0 overflow-hidden border-slate-200 hover:border-teal-600/40 transition-colors"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-teal-50/50 to-cyan-50/50 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative h-full w-full flex flex-col items-center">
                <div className="w-full p-2 text-xs font-medium text-teal-600 border-b border-slate-200 bg-slate-50/80">
                  <LayoutTemplate className="w-3 h-3 inline-block mr-1" />
                  Default Layout
                </div>
                <div className="flex-1 w-full p-2 flex flex-col justify-between">
                  {/* Mock resume content - Default */}
                  <div>
                    <div className="w-3/4 h-2 bg-slate-300 rounded mb-6" />
                    <div className="flex space-x-2 mb-4">
                      <div className="w-1/3 h-1 bg-slate-300 rounded" />
                      <div className="w-1/3 h-1 bg-slate-300 rounded" />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="w-1/3 h-1.5 bg-slate-300 rounded" />
                      <div className="space-y-1.5">
                        <div className="w-full h-1 bg-slate-300 rounded" />
                        <div className="w-11/12 h-1 bg-slate-300 rounded" />
                        <div className="w-10/12 h-1 bg-slate-300 rounded" />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="w-1/3 h-1.5 bg-slate-300 rounded" />
                      <div className="space-y-1.5">
                        <div className="w-full h-1 bg-slate-300 rounded" />
                        <div className="w-11/12 h-1 bg-slate-300 rounded" />
                        <div className="w-10/12 h-1 bg-slate-300 rounded" />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="w-1/3 h-1.5 bg-slate-300 rounded" />
                      <div className="space-y-1.5">
                        <div className="w-full h-1 bg-slate-300 rounded" />
                        <div className="w-11/12 h-1 bg-slate-300 rounded" />
                        <div className="w-10/12 h-1 bg-slate-300 rounded" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSettingsChange({...COMPACT_DOCUMENT_SETTINGS})}
              className="relative h-60 group p-0 overflow-hidden border-slate-200 hover:border-pink-600/40 transition-colors"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-pink-50/50 to-rose-50/50 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative h-full w-full flex flex-col items-center">
                <div className="w-full p-2 text-xs font-medium text-pink-600 border-b border-slate-200 bg-slate-50/80">
                  <LayoutTemplate className="w-3 h-3 inline-block mr-1" />
                  Compact Layout
                </div>
                <div className="flex-1 w-full p-2 flex flex-col justify-start space-y-2">
                  {/* Mock resume content - Compact */}
                  <div>
                    <div className="w-2/3 h-2 bg-slate-300 rounded mb-3" />
                    <div className="flex space-x-1.5 mb-2">
                      <div className="w-1/4 h-1 bg-slate-300 rounded" />
                      <div className="w-1/4 h-1 bg-slate-300 rounded" />
                      <div className="w-1/4 h-1 bg-slate-300 rounded" />
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="w-1/4 h-1.5 bg-slate-300 rounded" />
                      <div className="space-y-1">
                        <div className="w-full h-1 bg-slate-300 rounded" />
                        <div className="w-11/12 h-1 bg-slate-300 rounded" />
                        <div className="w-10/12 h-1 bg-slate-300 rounded" />
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="w-1/4 h-1.5 bg-slate-300 rounded" />
                      <div className="space-y-1">
                        <div className="w-full h-1 bg-slate-300 rounded" />
                        <div className="w-11/12 h-1 bg-slate-300 rounded" />
                        <div className="w-10/12 h-1 bg-slate-300 rounded" />
                        <div className="w-9/12 h-1 bg-slate-300 rounded" />
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="w-1/4 h-1.5 bg-slate-300 rounded" />
                      <div className="space-y-1">
                        <div className="w-full h-1 bg-slate-300 rounded" />
                        <div className="w-11/12 h-1 bg-slate-300 rounded" />
                        <div className="w-9/12 h-1 bg-slate-300 rounded" />
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="w-1/4 h-1.5 bg-slate-300 rounded" />
                      <div className="space-y-1">
                        <div className="w-full h-1 bg-slate-300 rounded" />
                        <div className="w-11/12 h-1 bg-slate-300 rounded" />
                        <div className="w-9/12 h-1 bg-slate-300 rounded" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Button>
          </div>

          {profileDefaults && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSettingsChange({...profileDefaults})}
              className="w-full mt-2 border-violet-200 hover:border-violet-400 hover:bg-violet-50/50 text-violet-600 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-2" />
              Reset to Profile Defaults
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-8">
          {reorderEnabled && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                  Section Order
                </Label>
                <div className="h-[1px] flex-1 mx-4 bg-gradient-to-r from-amber-200/30 via-orange-200/30 to-transparent" />
              </div>

              <p className="text-xs text-muted-foreground/80">
                Drag sections up or down to control the order they appear on your resume. Empty sections are hidden automatically.
              </p>

              <div className="space-y-2 bg-slate-50/50 rounded-lg border border-slate-200/50 p-2">
                {effectiveOrder.map((id, index) => (
                  <div
                    key={id}
                    className="flex items-center justify-between gap-2 rounded-md border border-amber-200/60 bg-white/70 px-3 py-2"
                  >
                    <span className="text-sm font-medium text-slate-700">
                      {SECTION_LABELS[id]}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => moveSection(index, -1)}
                        disabled={index === 0}
                        className="h-7 w-7 text-amber-700 hover:text-amber-800 hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => moveSection(index, 1)}
                        disabled={index === effectiveOrder.length - 1}
                        className="h-7 w-7 text-amber-700 hover:text-amber-800 hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col @[400px]:flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSectionOrderChange?.([...DEFAULT_SECTION_ORDER])}
                  className="flex-1 border-amber-200 hover:border-amber-400 hover:bg-amber-50/50 text-amber-700"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-2" />
                  Reset to Default
                </Button>
                {profileSectionOrderDefault && profileSectionOrderDefault.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSectionOrderChange?.([...profileSectionOrderDefault])}
                    className="flex-1 border-violet-200 hover:border-violet-400 hover:bg-violet-50/50 text-violet-600"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-2" />
                    Reset to Profile Default
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="space-y-6 ">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
                Footer Options
              </Label>
              <div className="h-[1px] flex-1 mx-4 bg-gradient-to-r from-teal-200/20 via-cyan-200/20 to-transparent" />
            </div>

            <div className="space-y-2 bg-slate-50/50 rounded-lg  border border-slate-200/50">
              <div className="flex items-center justify-between space-x-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  Show UBC Science Co-op Footer
                </Label>
                <Switch
                  checked={documentSettings?.show_ubc_footer ?? false}
                  onCheckedChange={(checked) =>
                    handleSettingsChange({
                      ...documentSettings,
                      show_ubc_footer: checked,
                    })
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground/60 mt-2">
                By enabling this footer, I confirm that I am a UBC Faculty of Science Co-op student and acknowledge that I am responsible for ensuring appropriate use of UBC branding in my resume.
              </p>
              
              {/* Footer Width Control - Only shown when footer is enabled */}
              {documentSettings?.show_ubc_footer && (
                <div className="space-y-2 mt-4 pt-4 border-t border-slate-200/50">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-muted-foreground">Footer Width</Label>
                    <div className="flex items-center">
                      <NumberInput
                        value={documentSettings?.footer_width ?? 95}
                        min={50}
                        max={100}
                        step={1}
                        onChange={(value) => 
                          handleSettingsChange({
                            ...documentSettings,
                            footer_width: value
                          })
                        }
                      />
                      <span className="text-xs text-muted-foreground/60 ml-1">%</span>
                    </div>
                  </div>
                  <Slider
                    value={[documentSettings?.footer_width ?? 95]}
                    min={50}
                    max={100}
                    step={1}
                    onValueChange={([value]) => 
                      handleSettingsChange({
                        ...documentSettings,
                        footer_width: value
                      })
                    }
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground/40">Narrow</span>
                    <span className="text-[10px] text-muted-foreground/40">Full Width</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Global Document Settings */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">Document</Label>
              <div className="h-[1px] flex-1 mx-4 bg-gradient-to-r from-teal-200/20 via-cyan-200/20 to-transparent" />
            </div>

            <div className="space-y-4 bg-slate-50/50 rounded-lg p-4 border border-slate-200/50">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-muted-foreground">Font Size</Label>
                  <div className="flex items-center">
                    <NumberInput
                      value={documentSettings?.document_font_size ?? 10}
                      min={8}
                      max={12}
                      step={0.5}
                      onChange={handleFontSizeChange}
                    />
                    <span className="text-xs text-muted-foreground/60 ml-1">pt</span>
                  </div>
                </div>
                <Slider
                  value={[documentSettings?.document_font_size ?? 10]}
                  min={8}
                  max={12}
                  step={0.5}
                  onValueChange={([value]) => 
                    handleSettingsChange({
                      ...documentSettings,
                      document_font_size: value
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-muted-foreground">Line Height</Label>
                  <div className="flex items-center">
                    <NumberInput
                      value={documentSettings?.document_line_height ?? 1.5}
                      min={1}
                      max={2}
                      step={0.1}
                      onChange={(value) => 
                        handleSettingsChange({
                          ...documentSettings,
                          document_line_height: value
                        })
                      }
                    />
                    <span className="text-xs text-muted-foreground/60 ml-1">x</span>
                  </div>
                </div>
                <Slider
                  value={[documentSettings?.document_line_height ?? 1.5]}
                  min={1}
                  max={2}
                  step={0.1}
                  onValueChange={([value]) => 
                    handleSettingsChange({
                      ...documentSettings,
                      document_line_height: value
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-muted-foreground">Vertical Margins</Label>
                  <div className="flex items-center">
                    <NumberInput
                      value={documentSettings?.document_margin_vertical ?? 36}
                      min={18}
                      max={108}
                      step={2}
                      onChange={(value) => 
                        handleSettingsChange({
                          ...documentSettings,
                          document_margin_vertical: value
                        })
                      }
                    />
                    <span className="text-xs text-muted-foreground/60 ml-1">pt</span>
                  </div>
                </div>
                <Slider
                  value={[documentSettings?.document_margin_vertical ?? 36]}
                  min={18}
                  max={108}
                  step={2}
                  onValueChange={([value]) => 
                    handleSettingsChange({
                      ...documentSettings,
                      document_margin_vertical: value
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-muted-foreground">Horizontal Margins</Label>
                  <div className="flex items-center">
                    <NumberInput
                      value={documentSettings?.document_margin_horizontal ?? 36}
                      min={18}
                      max={108}
                      step={2}
                      onChange={(value) => 
                        handleSettingsChange({
                          ...documentSettings,
                          document_margin_horizontal: value
                        })
                      }
                    />
                    <span className="text-xs text-muted-foreground/60 ml-1">pt</span>
                  </div>
                </div>
                <Slider
                  value={[documentSettings?.document_margin_horizontal ?? 36]}
                  min={18}
                  max={108}
                  step={2}
                  onValueChange={([value]) => 
                    handleSettingsChange({
                      ...documentSettings,
                      document_margin_horizontal: value
                    })
                  }
                />
              </div>
            </div>
          </div>

          {/* Header Settings */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">Header</Label>
              <div className="h-[1px] flex-1 mx-4 bg-gradient-to-r from-teal-200/20 via-cyan-200/20 to-transparent" />
            </div>

            <div className="space-y-4 bg-slate-50/50 rounded-lg p-4 border border-slate-200/50">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-muted-foreground">Name Size</Label>
                  <div className="flex items-center">
                    <NumberInput
                      value={documentSettings?.header_name_size ?? 24}
                      min={0}
                      max={40}
                      step={1}
                      onChange={(value) => 
                        handleSettingsChange({
                          ...documentSettings,
                          header_name_size: value
                        })
                      }
                    />
                    <span className="text-xs text-muted-foreground/60 ml-1">pt</span>
                  </div>
                </div>
                <Slider
                  value={[documentSettings?.header_name_size ?? 24]}
                  min={0}
                  max={40}
                  step={1}
                  onValueChange={([value]) => 
                    handleSettingsChange({
                      ...documentSettings,
                      header_name_size: value
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-muted-foreground">Space Below Name</Label>
                  <div className="flex items-center">
                    <NumberInput
                      value={documentSettings?.header_name_bottom_spacing ?? 24}
                      min={0}
                      max={50}
                      step={1}
                      onChange={(value) => 
                        handleSettingsChange({
                          ...documentSettings,
                          header_name_bottom_spacing: value
                        })
                      }
                    />
                    <span className="text-xs text-muted-foreground/60 ml-1">pt</span>
                  </div>
                </div>
                <Slider
                  value={[documentSettings?.header_name_bottom_spacing ?? 24]}
                  min={0}
                  max={50}
                  step={1}
                  onValueChange={([value]) => 
                    handleSettingsChange({
                      ...documentSettings,
                      header_name_bottom_spacing: value
                    })
                  }
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground/40">Compact</span>
                  <span className="text-[10px] text-muted-foreground/40">Spacious</span>
                </div>
              </div>
            </div>
          </div>

          {/* Skills Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">Skills</Label>
              <div className="h-[1px] flex-1 mx-4 bg-gradient-to-r from-teal-200/20 via-cyan-200/20 to-transparent" />
            </div>
            <SectionSettings title="Skills" section="skills" />
          </div>

          {/* Experience Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">Experience</Label>
              <div className="h-[1px] flex-1 mx-4 bg-gradient-to-r from-teal-200/20 via-cyan-200/20 to-transparent" />
            </div>
            <SectionSettings title="Experience" section="experience" />
          </div>

          {/* Projects Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">Projects</Label>
              <div className="h-[1px] flex-1 mx-4 bg-gradient-to-r from-teal-200/20 via-cyan-200/20 to-transparent" />
            </div>
            <SectionSettings title="Projects" section="projects" />
          </div>

          {/* Education Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">Education</Label>
              <div className="h-[1px] flex-1 mx-4 bg-gradient-to-r from-teal-200/20 via-cyan-200/20 to-transparent" />
            </div>
            <SectionSettings title="Education" section="education" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 