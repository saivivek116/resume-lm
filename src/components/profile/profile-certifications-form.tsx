'use client';

import { Certification } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface ProfileCertificationsFormProps {
  certifications: Certification[];
  onChange: (certifications: Certification[]) => void;
}

export function ProfileCertificationsForm({
  certifications,
  onChange,
}: ProfileCertificationsFormProps) {
  const addCertification = () => {
    onChange([...certifications, { name: "", url: "" }]);
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

  return (
    <div className="space-y-3">
      <Accordion
        type="multiple"
        className="space-y-3"
        defaultValue={certifications.map((_, index) => `certification-${index}`)}
      >
        {certifications.map((cert, index) => (
          <AccordionItem
            key={index}
            value={`certification-${index}`}
            className="bg-gradient-to-r from-yellow-500/5 via-amber-500/10 to-orange-500/5 backdrop-blur-md border border-amber-500/30 hover:border-amber-500/40 hover:shadow-lg transition-all duration-300 shadow-sm rounded-md overflow-hidden"
          >
            <AccordionTrigger className="px-4 py-2 hover:no-underline">
              <div className="flex items-center justify-between gap-3 flex-1">
                <div className="flex-1 text-left text-sm font-medium text-amber-900">
                  {cert.name || 'New Certification'}
                </div>
                {cert.url && (
                  <div className="text-xs text-gray-500 truncate max-w-[40%]">
                    {cert.url}
                  </div>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="px-4 pb-4 pt-2 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="relative group flex-1">
                    <Input
                      value={cert.name}
                      onChange={(e) => updateCertification(index, 'name', e.target.value)}
                      className="text-base bg-white/50 border-gray-200 rounded-md h-8
                        focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20
                        hover:border-amber-500/30 hover:bg-white/60 transition-colors
                        placeholder:text-gray-400"
                      placeholder="Certificate Name"
                    />
                    <div className="absolute -top-2 left-2 px-1 bg-white/80 text-[9px] font-medium text-amber-700">
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
                    className="bg-white/50 border-gray-200 rounded-md h-8
                      focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20
                      hover:border-amber-500/30 hover:bg-white/60 transition-colors
                      placeholder:text-gray-400"
                    placeholder="https://verify.example.com/your-credential"
                  />
                  <div className="absolute -top-2 left-2 px-1 bg-white/80 text-[9px] font-medium text-amber-700">
                    URL
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <Button
        onClick={addCertification}
        variant="outline"
        className="w-full bg-gradient-to-r from-yellow-500/5 via-amber-500/10 to-orange-500/5
          hover:from-yellow-500/10 hover:via-amber-500/15 hover:to-orange-500/10
          border-2 border-dashed border-amber-500/30 hover:border-amber-500/40
          text-amber-700 hover:text-amber-800 transition-all duration-300"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Certification
      </Button>
    </div>
  );
}
