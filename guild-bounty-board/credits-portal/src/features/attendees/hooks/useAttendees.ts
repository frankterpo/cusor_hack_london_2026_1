/**
 * Hook for fetching and managing attendee data
 *
 * Redemption name suggestions: checked-in guests only (hasCheckedIn from API).
 * Ops may pre-assign codes (hasRedeemed); those names still appear in the picker.
 */

import { useState, useEffect } from 'react';

export interface AttendeeForSuggestion {
  id: string;
  name: string;
  email: string;
  hasRedeemed: boolean;
  /** From API: only checked-in guests are eligible for the redeem name picker */
  hasCheckedIn?: boolean;
}

export function useAttendees(projectId?: string) {
  const [attendees, setAttendees] = useState<AttendeeForSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAttendees();
  }, [projectId]);

  const fetchAttendees = async () => {
    try {
      setIsLoading(true);
      const url = projectId ? `/credits/api/attendees?projectId=${projectId}` : '/credits/api/attendees';
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch attendees');
      }
      
      const data = await response.json();
      setAttendees(data.attendees || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attendees');
      console.error('Error fetching attendees:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /** Checked-in guests only (for redeem name search). Legacy rows without flag still show. */
  const checkedInForRedeem = attendees.filter(
    (a) => a.hasCheckedIn !== false
  );

  // Find attendee by exact name match (checked-in pool so ops pre-assign does not hide names)
  const findAttendeeByName = (name: string): AttendeeForSuggestion | null => {
    const trimmedName = name.trim();
    return checkedInForRedeem.find(
      attendee => attendee.name.toLowerCase() === trimmedName.toLowerCase()
    ) || null;
  };

  // Get name suggestions based on partial input (matches any word in the search against any part of the name)
  const getNameSuggestions = (input: string): AttendeeForSuggestion[] => {
    if (!input || input.length < 1) return [];

    const searchWords = input.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);
    return checkedInForRedeem
      .filter(attendee => {
        const name = attendee.name.toLowerCase();
        return searchWords.every(word => name.includes(word));
      })
      .slice(0, 10);
  };

  return {
    attendees,
    isLoading,
    error,
    findAttendeeByName,
    getNameSuggestions,
    refetch: fetchAttendees,
  };
}
