import { FileText, Image, FileSpreadsheet, File } from 'lucide-react'

const FILE_TYPES = {
  PDF:  { Icon: FileText,        iconCls: 'text-red-500',     bgCls: 'bg-red-50'     },
  JPG:  { Icon: Image,           iconCls: 'text-violet-500',  bgCls: 'bg-violet-50'  },
  JPEG: { Icon: Image,           iconCls: 'text-violet-500',  bgCls: 'bg-violet-50'  },
  PNG:  { Icon: Image,           iconCls: 'text-violet-500',  bgCls: 'bg-violet-50'  },
  WEBP: { Icon: Image,           iconCls: 'text-violet-500',  bgCls: 'bg-violet-50'  },
  DOCX: { Icon: FileText,        iconCls: 'text-blue-500',    bgCls: 'bg-blue-50'    },
  XLSX: { Icon: FileSpreadsheet, iconCls: 'text-emerald-500', bgCls: 'bg-emerald-50' },
}

const SIZES = {
  sm: { wrap: 'w-9 h-9',   radius: 'rounded-lg',  px: 18 },
  md: { wrap: 'w-11 h-11', radius: 'rounded-xl',  px: 22 },
  lg: { wrap: 'w-13 h-13', radius: 'rounded-xl',  px: 26 },
}

export default function FileIcon({ type, size = 'sm' }) {
  const { Icon, iconCls, bgCls } = FILE_TYPES[type?.toUpperCase()] || { Icon: File, iconCls: 'text-gray-400', bgCls: 'bg-gray-100' }
  const { wrap, radius, px } = SIZES[size] || SIZES.sm
  return (
    <div className={`${wrap} ${bgCls} ${radius} flex items-center justify-center shrink-0`}>
      <Icon size={px} className={iconCls} strokeWidth={1.6} />
    </div>
  )
}
