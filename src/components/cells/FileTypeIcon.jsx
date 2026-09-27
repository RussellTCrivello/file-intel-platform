import { FileText, FileSpreadsheet, Presentation, Image, Video, Mail, Archive, FileQuestion } from 'lucide-react';

const ICONS = {
  Document: FileText,
  Spreadsheet: FileSpreadsheet,
  Presentation: Presentation,
  Image: Image,
  Video: Video,
  Email: Mail,
  Archive: Archive,
  Text: FileText,
  Data: FileSpreadsheet,
};

export default function FileTypeIcon({ family, color, size = 16, className = '' }) {
  const Icon = ICONS[family] || FileQuestion;
  return <Icon size={size} className={className} style={{ color }} strokeWidth={2} />;
}
