import { format } from "date-fns"
import { Calendar as CalendarIcon, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  date: Date | undefined
  setDate: (date: Date | undefined) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  showClear?: boolean
}

export function DatePicker({ 
  date, 
  setDate, 
  placeholder = "Select date", 
  className, 
  disabled = false,
  showClear = false 
}: DatePickerProps) {
  return (
    <div className="relative flex items-center">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "justify-start text-left font-normal h-9",
              !date && "text-muted-foreground",
              showClear && date ? "pr-8" : "",
              className
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            {date ? format(date, "MMM d, yyyy") : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-white border border-gray-200 shadow-lg" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            initialFocus
            className="bg-white rounded-md"
          />
        </PopoverContent>
      </Popover>
      {showClear && date && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-0 h-full px-2 hover:bg-transparent"
          onClick={(e) => {
            e.stopPropagation();
            setDate(undefined);
          }}
        >
          <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
        </Button>
      )}
    </div>
  )
}
