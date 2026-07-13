import { Resume } from "@/lib/types";

/**
 * Trigger a browser download for a generated Blob by creating a temporary
 * anchor element, clicking it, and cleaning up the object URL.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Build a download filename following the app convention:
 *   First_Last[_Role][_Company]_<Kind>.<ext>
 * The company suffix is derived from a tailored resume's "<name> at <company>" pattern.
 */
export function buildDocFilename(
  resume: Resume,
  kind: 'Resume' | 'Cover_Letter',
  ext: 'pdf' | 'docx'
): string {
  const role = resume.target_role
    ? `_${resume.target_role.replace(/\s+/g, '_')}`
    : '';
  const company = !resume.is_base_resume && resume.name?.includes(' at ')
    ? `_${resume.name.split(' at ').slice(1).join(' at ').replace(/\s+/g, '_')}`
    : '';
  return `${resume.first_name}_${resume.last_name}${role}${company}_${kind}.${ext}`;
}
