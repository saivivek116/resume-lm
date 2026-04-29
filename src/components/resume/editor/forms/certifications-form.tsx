'use client';

import { Certification, Profile } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { ImportFromProfileDialog } from "../../management/dialogs/import-from-profile-dialog";
import { memo } from 'react';
import { cn } from "@/lib/utils";

interface CertificationsFormProps {
  certifications: Certification[];
  onChange: (certifications: Certification[]) => void;
  profile: Profile;
}

function arePropsEqual(prev: CertificationsFormProps, next: CertificationsFormProps) {
  return (
    JSON.stringify(prev.certifications) === JSON.stringify(next.certifications) &&
    prev.profile.id === next.profile.id
  );
}

export const CertificationsForm = memo(function CertificationsFormComponent({
  certifications,
  onChange,
  profile,
}: CertificationsFormProps) {
  const addCertification = () => {
    onChange([{ name: "", url: "" }, ...certifications]);
  };

  const updateCertification = (
    index: number,
    field: keyof Certification,
    value: string
  ) => {
    const updated = [...certifications];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeCertification = (index: number) => {
    onChange(certifications.filter((_, i) => i !== index));
  };

  const moveCertification = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= certifications.length) return;
    const updated = [...certifications];
    const [item] = updated.splice(index, 1);
    updated.splice(newIndex, 0, item);
    onChange(updated);
  };

  const handleImportFromProfile = (imported: Certification[]) => {
    onChange([...imported, ...certifications]);
  };

  return (
    <div className="space-y-2 sm:space-y-3">
      <div className="@container">
        <div className={cn(
          "flex flex-col @[400px]:flex-row gap-2",
          "transition-all duration-300 ease-in-out"
        )}>
          <Button
            variant="outline"
            className={cn(
              "flex-1 h-9 min-w-[120px]",
              "bg-gradient-to-r from-yellow-500/5 via-amber-500/10 to-orange-500/5",
              "hover:from-yellow-500/10 hover:via-amber-500/15 hover:to-orange-500/10",
              "border-2 border-dashed border-amber-500/30 hover:border-amber-500/40",
              "text-amber-700 hover:text-amber-800",
              "transition-all duration-300",
              "rounded-xl",
              "whitespace-nowrap text-[11px] @[300px]:text-sm"
            )}
            onClick={addCertification}
          >
            <Plus className="h-4 w-4 mr-2 shrink-0" />
            Add Certification
          </Button>

          <ImportFromProfileDialog<Certification>
            profile={profile}
            onImport={handleImportFromProfile}
            type="certifications"
            buttonClassName={cn(
              "flex-1 mb-0 h-9 min-w-[120px]",
              "whitespace-nowrap text-[11px] @[300px]:text-sm",
              "bg-gradient-to-r from-yellow-500/5 via-amber-500/10 to-orange-500/5",
              "hover:from-yellow-500/10 hover:via-amber-500/15 hover:to-orange-500/10",
              "border-2 border-dashed border-amber-500/30 hover:border-amber-500/40",
              "text-amber-700 hover:text-amber-800"
            )}
          />
        </div>
      </div>

      {certifications.map((cert, index) => (
        <Card
          key={index}
          className={cn(
            "relative group transition-all duration-300",
            "bg-gradient-to-r from-yellow-500/5 via-amber-500/10 to-orange-500/5",
            "backdrop-blur-md border-2 border-amber-500/30",
            "shadow-sm"
          )}
        >
          <CardContent className="p-3 sm:p-4 space-y-3 sm:space-y-4">
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center justify-between gap-2 sm:gap-3">
                <div className="relative group flex-1 min-w-0">
                  <Input
                    value={cert.name}
                    onChange={(e) => updateCertification(index, 'name', e.target.value)}
                    className={cn(
                      "text-sm font-semibold h-9",
                      "bg-white/50 border-gray-200 rounded-lg",
                      "focus:border-amber-500/40 focus:ring-2 focus:ring-amber-500/20",
                      "hover:border-amber-500/30 hover:bg-white/60 transition-colors",
                      "placeholder:text-gray-400"
                    )}
                    placeholder="Certificate Name (e.g. AWS Certified Solutions Architect)"
                  />
                  <div className="absolute -top-2 left-2 px-1 bg-white/80 text-[7px] sm:text-[9px] font-medium text-amber-700">
                    NAME
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeCertification(index)}
                  className="text-gray-400 hover:text-red-500 transition-colors duration-300"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="relative group">
                <Input
                  type="url"
                  value={cert.url}
                  onChange={(e) => updateCertification(index, 'url', e.target.value)}
                  className={cn(
                    "h-9 bg-white/50 border-gray-200 rounded-lg",
                    "focus:border-amber-500/40 focus:ring-2 focus:ring-amber-500/20",
                    "hover:border-amber-500/30 hover:bg-white/60 transition-colors",
                    "placeholder:text-gray-400",
                    "text-[10px] sm:text-xs"
                  )}
                  placeholder="https://verify.example.com/your-credential"
                />
                <div className="absolute -top-2 left-2 px-1 bg-white/80 text-[7px] sm:text-[9px] font-medium text-amber-700">
                  URL
                </div>
              </div>
            </div>
          </CardContent>
          <div className="flex justify-end gap-2 pb-1 pr-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => moveCertification(index, -1)}
              disabled={index === 0}
              className={cn(
                "h-6 w-8 text-amber-700 hover:text-amber-800",
                "bg-white/70 hover:bg-white",
                "border border-amber-200/70",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => moveCertification(index, 1)}
              disabled={index === certifications.length - 1}
              className={cn(
                "h-6 w-8 text-amber-700 hover:text-amber-800",
                "bg-white/70 hover:bg-white",
                "border border-amber-200/70",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}, arePropsEqual);
