'use client';

import { useState } from 'react';
import { AttendeeAutocomplete } from './AttendeeAutocomplete';
import { maskEmail } from '@/lib/utils';
import type { AttendeeForSuggestion } from '../hooks/useAttendees';
import type { AttendeeValidationResponse } from '../model';

type ValidationStep = 'name' | 'email' | 'ready';

interface RedemptionFormProps {
  projectId?: string;
}

export function RedemptionForm({ projectId }: RedemptionFormProps = {}) {
  const [currentStep, setCurrentStep] = useState<ValidationStep>('name');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedAttendee, setSelectedAttendee] = useState<AttendeeForSuggestion | null>(null);
  const [expectedEmail, setExpectedEmail] = useState<string | null>(null);
  const effectiveProjectId = selectedAttendee?.projectId || projectId;

  const handleAttendeeSelect = (attendee: AttendeeForSuggestion | null) => {
    setSelectedAttendee(attendee);
    setError(null);
    if (attendee) {
      setName(attendee.name);
      setCurrentStep('name');
      setExpectedEmail(attendee.email);
      setEmail(attendee.email);
    } else {
      setCurrentStep('name');
      setExpectedEmail(null);
      setEmail('');
    }
  };

  const validateNameStep = async () => {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!selectedAttendee) {
      setError('Please select your name from the suggestions');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/credits/api/attendees/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'name',
          name: name.trim(),
          projectId: effectiveProjectId,
          eventId: effectiveProjectId ? undefined : 'sample-event-1',
        }),
      });
      const result = await response.json();
      const validationData = result.data as AttendeeValidationResponse;
      if (!result.success || !validationData.isValid) throw new Error(validationData.error || 'Name validation failed');
      if (validationData.hasAlreadyRedeemed && validationData.cursorUrl) {
        const params = new URLSearchParams({
          cursorUrl: validationData.cursorUrl,
          name: name.trim(),
        });
        window.location.href = `/credits/success?${params.toString()}`;
        return;
      }
      if (validationData.hasAlreadyRedeemed) {
        throw new Error(
          'A code is already assigned to this guest, but the referral link could not be loaded. Ask an organizer.'
        );
      }
      const resolved = validationData.resolvedName?.trim() || name.trim();
      const resolvedEmail = validationData.expectedEmail || selectedAttendee?.email || '';
      setName(resolved);
      setExpectedEmail(resolvedEmail || null);
      if (resolvedEmail) setEmail(resolvedEmail);

      if (!resolvedEmail) {
        throw new Error('This attendee is missing an email in the checked-in guest list. Ask an organizer.');
      }

      const redeemResponse = await fetch('/credits/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: resolved,
          email: resolvedEmail.toLowerCase().trim(),
          projectId: effectiveProjectId,
          eventId: effectiveProjectId ? undefined : 'sample-event-1',
        }),
      });
      const redeemResult = await redeemResponse.json();
      if (!redeemResult.success) {
        throw new Error(redeemResult.error || 'Failed to claim code');
      }
      const params = new URLSearchParams({
        cursorUrl: redeemResult.data.cursorUrl,
        name: redeemResult.data.name || resolved,
      });
      window.location.href = `/credits/success?${params.toString()}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const validateEmailStep = async () => {
    const emailForValidation = (expectedEmail || email).toLowerCase().trim();
    if (!emailForValidation) {
      setError('Please enter your email address');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/credits/api/attendees/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'email',
          name: name.trim(),
          email: emailForValidation,
          projectId: effectiveProjectId,
          eventId: effectiveProjectId ? undefined : 'sample-event-1',
        }),
      });
      const result = await response.json();
      const validationData = result.data as AttendeeValidationResponse;
      if (!result.success || !validationData.isValid) throw new Error(validationData.error || 'Email validation failed');
      if (validationData.hasAlreadyRedeemed && validationData.cursorUrl) {
        const params = new URLSearchParams({
          cursorUrl: validationData.cursorUrl,
          name: name.trim(),
        });
        window.location.href = `/credits/success?${params.toString()}`;
        return;
      }
      if (validationData.hasAlreadyRedeemed) {
        throw new Error(
          'A code is already assigned to this guest, but the referral link could not be loaded. Ask an organizer.'
        );
      }
      setCurrentStep('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRedemption = async () => {
    const emailForRedemption = (expectedEmail || email).toLowerCase().trim();
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/credits/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: emailForRedemption,
          projectId: effectiveProjectId,
          eventId: effectiveProjectId ? undefined : 'sample-event-1',
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to claim code');
      const params = new URLSearchParams({ cursorUrl: result.data.cursorUrl, name: result.data.name });
      window.location.href = `/credits/success?${params.toString()}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Redemption failed');
    } finally {
      setIsLoading(false);
    }
  };

  const resetToNameStep = () => {
    setCurrentStep('name');
    setEmail('');
    setExpectedEmail(null);
    setError(null);
  };

  const inputClass =
    'w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-sm font-semibold text-primary">Attendee info</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {currentStep === 'name' && 'Select your checked-in name'}
          {currentStep === 'email' && 'Step 2: Confirm your email'}
          {currentStep === 'ready' && 'Ready to claim your code'}
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          {currentStep === 'name' ? (
            <>
              <AttendeeAutocomplete
                value={name}
                onChange={setName}
                onAttendeeSelect={handleAttendeeSelect}
                error={error ?? undefined}
                disabled={isLoading}
                projectId={projectId}
              />
              <button
                type="button"
                onClick={validateNameStep}
                disabled={!selectedAttendee || isLoading}
                className="btn-event-primary w-full py-3 text-sm disabled:opacity-50"
              >
                {isLoading ? 'Claiming…' : 'Claim my Cursor credits'}
              </button>
            </>
          ) : (
            <div className="space-y-2">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Name
              </span>
              <div
                className="rounded-md border border-input bg-muted/25 px-3 py-2.5 text-sm text-foreground"
                aria-label="Confirmed attendee name"
              >
                {name}
              </div>
            </div>
          )}
        </div>

        {(currentStep === 'email' || currentStep === 'ready') && (
          <div className="space-y-3">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</label>
            {expectedEmail && (
              <p className="text-sm text-muted-foreground">
                Match: <span className="font-medium text-accent-foreground">{maskEmail(expectedEmail)}</span>
              </p>
            )}
            <input
              type="email"
              autoComplete="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => {
                if (!expectedEmail) setEmail(e.target.value);
              }}
              readOnly={!!expectedEmail}
              disabled={currentStep === 'ready' || isLoading}
              className={inputClass}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetToNameStep}
                disabled={isLoading}
                className="btn-event-ghost flex-1 py-2.5 text-sm disabled:opacity-50"
              >
                Back
              </button>
              {currentStep === 'email' && (
                <button
                  type="button"
                  onClick={validateEmailStep}
                  disabled={!email.trim() || isLoading}
                  className="btn-event-primary flex-1 py-2.5 text-sm disabled:opacity-50"
                >
                  {isLoading ? 'Validating…' : 'Verify'}
                </button>
              )}
            </div>
          </div>
        )}

        {currentStep === 'ready' && (
          <div className="space-y-4">
            <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-3 text-sm text-foreground">
              Name and email verified. Ready to claim your Cursor code.
            </div>
            <button
              type="button"
              onClick={handleRedemption}
              disabled={isLoading}
              className="btn-event-primary w-full py-3.5 text-sm disabled:opacity-50"
            >
              {isLoading ? 'Claiming…' : 'Claim my Cursor code'}
            </button>
          </div>
        )}

        {error && currentStep !== 'name' && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
        )}
      </div>
    </div>
  );
}
