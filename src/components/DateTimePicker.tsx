import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface DateTimePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  showTime?: boolean;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick a date and time",
  className,
  showTime = true,
}: DateTimePickerProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(value);
  const [timeValue, setTimeValue] = React.useState<string>(
    value ? format(value, "HH:mm") : ""
  );

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) {
      setSelectedDate(undefined);
      onChange?.(undefined);
      return;
    }

    const newDate = new Date(date);
    if (showTime && timeValue) {
      const [hours, minutes] = timeValue.split(":").map(Number);
      newDate.setHours(hours, minutes);
    }
    
    setSelectedDate(newDate);
    onChange?.(newDate);
  };

  const handleTimeChange = (time: string) => {
    setTimeValue(time);
    if (showTime && selectedDate && time) {
      const [hours, minutes] = time.split(":").map(Number);
      const newDate = new Date(selectedDate);
      newDate.setHours(hours, minutes);
      setSelectedDate(newDate);
      onChange?.(newDate);
    }
  };

  return (
    <div className={cn("flex gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "flex-1 justify-start text-left font-normal",
              !selectedDate && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selectedDate ? format(selectedDate, "PPP") : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            initialFocus
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
      {showTime && (
        <Input
          type="time"
          value={timeValue}
          onChange={(e) => handleTimeChange(e.target.value)}
          className="w-32"
        />
      )}
    </div>
  );
}