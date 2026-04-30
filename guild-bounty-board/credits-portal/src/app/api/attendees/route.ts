import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { hasMeaningfulCheckedIn } from '@/lib/attendee-checked-in';
import { LONDON_CREDIT_ASSIGNMENTS } from '@/lib/london-credit-assignments';

const LONDON_2026_FIRESTORE_PROJECT_ID = 'nynsjuhYRTQhxTNZgywQ';

/**
 * Public API route for fetching attendees during redemption flow
 * This is separate from the admin attendees API and handles the public redemption process
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let projectId = searchParams.get('projectId');
    
    // For MVP compatibility: if no projectId provided, try to fetch legacy data first
    if (!projectId) {
      // First try to fetch from the old structure (for existing data without projectId)
      try {
        const legacyAttendeesSnapshot = await getDocs(collection(db, 'attendees'));
        const legacyAttendees = legacyAttendeesSnapshot.docs
          .filter((doc) => !doc.data().projectId) // Only get truly legacy data (no projectId field)
          .map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name,
              email: data.email,
              projectId: data.projectId || null,
              hasRedeemed: data.hasRedeemedCode || false,
              hasCheckedIn:
                hasMeaningfulCheckedIn(data as Record<string, unknown>) ||
                !!data.hasRedeemedCode,
            };
          })
          .filter(attendee => attendee.name && attendee.email);

        if (legacyAttendees.length > 0) {
          return NextResponse.json({ 
            success: true, 
            attendees: legacyAttendees 
          });
        }
      } catch {
        // If legacy fetch fails, continue with project-based approach
      }
      
      // If no legacy data found, use default projectId
      projectId = 'sample-event-1';
    }

    // Fetch attendees for the specific project
    const attendeesSnapshot = await getDocs(
      query(collection(db, 'attendees'), where('projectId', '==', projectId))
    );

    let attendeeDocs = attendeesSnapshot.docs;

    // London hotfix: the public project route can pass an old slug/id while ops imported
    // the checked-in Luma attendees under the Firestore doc id below.
    if (attendeeDocs.length === 0 && projectId !== LONDON_2026_FIRESTORE_PROJECT_ID) {
      const fallbackSnapshot = await getDocs(
        query(
          collection(db, 'attendees'),
          where('projectId', '==', LONDON_2026_FIRESTORE_PROJECT_ID)
        )
      );
      attendeeDocs = fallbackSnapshot.docs;
    }

    if (attendeeDocs.length === 0) {
      return NextResponse.json({
        success: true,
        attendees: LONDON_CREDIT_ASSIGNMENTS.map((attendee) => ({
          id: attendee.attendeeId,
          name: attendee.name,
          email: attendee.email,
          projectId: attendee.projectId,
          hasRedeemed: Boolean(attendee.cursorUrl || attendee.code),
          hasCheckedIn: true,
        })),
      });
    }

    // Process attendees
    const attendees = attendeeDocs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        email: data.email,
        projectId: data.projectId || projectId,
        hasRedeemed: data.hasRedeemedCode || false,
        hasCheckedIn:
          hasMeaningfulCheckedIn(data as Record<string, unknown>) ||
          !!data.hasRedeemedCode,
      };
    }).filter((attendee) => attendee.name && attendee.email);

    return NextResponse.json({ 
      success: true, 
      attendees 
    });
  } catch (error) {
    console.error('Public attendees API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch attendees',
        attendees: []
      },
      { status: 500 }
    );
  }
}
