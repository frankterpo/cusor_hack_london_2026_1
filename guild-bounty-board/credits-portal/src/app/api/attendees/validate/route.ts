import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import { AttendeeValidationStepSchema } from '@/features/attendees/model';
import type { AttendeeValidationResponse } from '@/features/attendees/model';
import { hasMeaningfulCheckedIn } from '@/lib/attendee-checked-in';

function normEmail(em: string) {
  return em.trim().toLowerCase();
}

async function findAttendeeInProject(
  projectId: string,
  nameInput: string,
  emailInput?: string
) {
  const snap = await getDocs(
    query(collection(db, 'attendees'), where('projectId', '==', projectId))
  );
  const wantName = nameInput.trim().toLowerCase();
  const wantEmail = emailInput != null ? normEmail(emailInput) : null;
  for (const d of snap.docs) {
    const x = d.data();
    if ((String(x.name || '').trim().toLowerCase() !== wantName)) continue;
    if (wantEmail != null && normEmail(String(x.email || '')) !== wantEmail)
      continue;
    return d;
  }
  return null;
}

async function cursorUrlAlreadyAssigned(
  attendeeId: string,
  attendeeData: Record<string, unknown>
): Promise<string | undefined> {
  const rid = attendeeData.redeemedCodeId;
  if (typeof rid === 'string' && rid.length > 0) {
    const codeSnap = await getDoc(doc(db, 'codes', rid));
    const cd = codeSnap.data();
    const u = cd?.cursorUrl ?? cd?.cursor_url;
    if (typeof u === 'string' && u.length > 0) return u;
  }
  const projectId = String(attendeeData.projectId || '');
  if (projectId) {
    const rq = query(
      collection(db, 'redemptions'),
      where('projectId', '==', projectId),
      where('attendeeId', '==', attendeeId),
      limit(1)
    );
    const rs = await getDocs(rq);
    if (!rs.empty) {
      const r = rs.docs[0].data();
      const u = r.codeUrl ?? r.cursorUrl;
      if (typeof u === 'string' && u.length > 0) return u;
    }
  }
  return undefined;
}

/**
 * API route for validating attendee information during redemption
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input data
    const validatedData = AttendeeValidationStepSchema.parse(body);

    // Handle backward compatibility: use eventId if projectId not provided
    const projectId =
      validatedData.projectId || validatedData.eventId || 'sample-event-1';

    if (validatedData.step === 'name') {
      return await validateNameStep(validatedData.name, projectId, validatedData);
    } else if (validatedData.step === 'email') {
      return await validateEmailStep(
        validatedData.name,
        validatedData.email!,
        projectId,
        validatedData
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid validation step',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Attendee validation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Validation failed',
      },
      { status: 500 }
    );
  }
}

async function validateNameStep(
  name: string,
  projectId: string,
  validatedData?: { projectId?: string; eventId?: string }
) {
  try {
    let attendeeDoc = await findAttendeeInProject(projectId, name);

    // Legacy fallback
    if (
      !attendeeDoc &&
      projectId === 'sample-event-1' &&
      !validatedData?.projectId &&
      validatedData?.eventId === 'sample-event-1'
    ) {
      const legacy = await getDocs(
        query(collection(db, 'attendees'), where('name', '==', name.trim()))
      );
      attendeeDoc = legacy.docs[0] || null;
    }

    if (!attendeeDoc) {
      const response: AttendeeValidationResponse = {
        isValid: false,
        hasAlreadyRedeemed: false,
        error:
          'Name not found in attendee list. Please check the spelling or contact an organizer.',
      };

      return NextResponse.json({
        success: true,
        data: response,
      });
    }

    const attendeeData = attendeeDoc.data();
    if (!hasMeaningfulCheckedIn(attendeeData as Record<string, unknown>)) {
      const response: AttendeeValidationResponse = {
        isValid: false,
        hasAlreadyRedeemed: false,
        error:
          'This name is registered but not on the checked-in guest list yet. Ask an organizer after check-in.',
      };
      return NextResponse.json({ success: true, data: response });
    }

    const hasAlreadyRedeemed = !!(attendeeData.hasRedeemedCode || false);
    const cursorUrl = hasAlreadyRedeemed
      ? await cursorUrlAlreadyAssigned(attendeeDoc.id, attendeeData as Record<string, unknown>)
      : undefined;

    const resolvedName = String(attendeeData.name ?? name).trim();
    const response: AttendeeValidationResponse = {
      isValid: true,
      attendeeId: attendeeDoc.id,
      resolvedName,
      expectedEmail: String(attendeeData.email ?? '').trim(),
      hasAlreadyRedeemed,
      cursorUrl: cursorUrl || undefined,
      error: undefined,
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Name validation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Name validation failed',
      },
      { status: 500 }
    );
  }
}

async function validateEmailStep(
  name: string,
  email: string,
  projectId: string,
  validatedData?: { projectId?: string; eventId?: string }
) {
  try {
    let attendeeDoc = await findAttendeeInProject(projectId, name, email);

    if (
      !attendeeDoc &&
      projectId === 'sample-event-1' &&
      validatedData &&
      !validatedData.projectId &&
      validatedData.eventId === 'sample-event-1'
    ) {
      const legacy = await getDocs(
        query(
          collection(db, 'attendees'),
          where('name', '==', name.trim()),
          where('email', '==', email.toLowerCase().trim())
        )
      );
      attendeeDoc = legacy.docs[0] || null;
    }

    if (!attendeeDoc) {
      const response: AttendeeValidationResponse = {
        isValid: false,
        hasAlreadyRedeemed: false,
        error: 'Email does not match the expected address for this name.',
      };

      return NextResponse.json({
        success: true,
        data: response,
      });
    }

    const attendeeData = attendeeDoc.data();
    if (!hasMeaningfulCheckedIn(attendeeData as Record<string, unknown>)) {
      const response: AttendeeValidationResponse = {
        isValid: false,
        hasAlreadyRedeemed: false,
        error:
          'Check-in not recorded for this guest. Ask an organizer to sync Luma check-ins.',
      };
      return NextResponse.json({ success: true, data: response });
    }

    const hasAlreadyRedeemed = !!(attendeeData.hasRedeemedCode || false);
    const cursorUrl = hasAlreadyRedeemed
      ? await cursorUrlAlreadyAssigned(attendeeDoc.id, attendeeData as Record<string, unknown>)
      : undefined;

    const response: AttendeeValidationResponse = {
      isValid: true,
      attendeeId: attendeeDoc.id,
      hasAlreadyRedeemed,
      cursorUrl: cursorUrl || undefined,
      error: undefined,
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Email validation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Email validation failed',
      },
      { status: 500 }
    );
  }
}