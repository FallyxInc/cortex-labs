"use client";

import { useState, useCallback } from "react";
import { MONTHS_FORWARD, MONTHS_BACKWARD } from "@/types/behaviourTypes";

function getCurrentMonth(): string {
  const today = new Date();
  const month = (today.getMonth() + 1).toString().padStart(2, "0");
  return MONTHS_FORWARD[month] || "January";
}

function getCurrentMonthRange(): { startDate: string; endDate: string } {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return {
    startDate: firstDay.toISOString().split("T")[0],
    endDate: lastDay.toISOString().split("T")[0],
  };
}

interface UseDateRangeReturn {
  startDate: string;
  endDate: string;
  setStartDate: (date: string) => void;
  setEndDate: (date: string) => void;
  desiredMonth: string;
  desiredYear: number;
  setDesiredMonth: (month: string) => void;
  setDesiredYear: (year: number) => void;
  handleStartDateChange: (newStartDate: string) => void;
  handleEndDateChange: (newEndDate: string) => void;
}

export function useDateRange(): UseDateRangeReturn {
  const initialRange = getCurrentMonthRange();

  const [startDate, setStartDate] = useState<string>(initialRange.startDate);
  const [endDate, setEndDate] = useState<string>(initialRange.endDate);
  const [desiredMonth, setDesiredMonth] = useState<string>(getCurrentMonth());
  const [desiredYear, setDesiredYear] = useState<number>(
    new Date().getFullYear(),
  );

  const handleStartDateChange = useCallback(
    (newStartDate: string) => {
      setStartDate(newStartDate);
      // If end date is before new start date, update end date
      if (endDate && newStartDate > endDate) {
        setEndDate(newStartDate);
      }
    },
    [endDate],
  );

  const handleEndDateChange = useCallback(
    (newEndDate: string) => {
      setEndDate(newEndDate);
      // If start date is after new end date, update start date
      if (startDate && newEndDate < startDate) {
        setStartDate(newEndDate);
      }
    },
    [startDate],
  );

  return {
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    desiredMonth,
    desiredYear,
    setDesiredMonth,
    setDesiredYear,
    handleStartDateChange,
    handleEndDateChange,
  };
}
