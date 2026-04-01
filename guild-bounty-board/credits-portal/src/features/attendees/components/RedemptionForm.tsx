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

const btnStyle = {
  background: 'linear-gradient(180deg, #3dffa3 0%, #1db86e 100%)',
  color: '#0b0b0b',
  fontFamily: "'Press Start 2P', monospace",
  fontSize: '0.65rem',
  border: '3px solid #1a9957',
  boxShadow: '4px 4px 0 rgba(0, 0, 0, 0.45)',
};

const btnOutlineStyle = {
  background: 'transparent',
  color: '#3dffa3',
  fontFamily: "'Press Start 2P', monospace",
  fontSize: '0.65rem',
  border: '2px solid #3dffa3',
};

const inputStyle = {
  background: '#0b0b0b',
  border: '2px solid #333',
  color: '#e0e0e0',
  fontFamily: "'VT323', monospace",
  fontSize: '1.15rem',
  padding: '10px 14px',
  width: '100%',
};

export function RedemptionForm({ projectId }: RedemptionFormProps = {}) {
  const [currentStep, setCurrentStep] = useState<ValidationStep>('name');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedAttendee, setSelectedAttendee] = useState<AttendeeForSuggestion | null>(null);
  const [expectedEmail, setExpectedEmail] = useState<string | null>(null);

  const handleAttendeeSelect = (attendee: AttendeeForSuggestion | null) => {
    setSelectedAttendee(attendee);
    setError(null);
    if (attendee) {
      setCurrentStep('email');
      setExpectedEmail(attendee.email);
    } else {
      setCurrentStep('name');
      setExpectedEmail(null);
    }
  };

  const validateNameStep = async () => {
    if (!name.trim()) { setError('Please enter your name'); return; }
    if (!selectedAttendee) { setError('Please select your name from the suggestions'); return; }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/credits/api/attendees/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'name', name: name.trim(), projectId, eventId: projectId ? undefined : 'sample-event-1' }),
      });
      const result = await response.json();
      const validationData = result.data as AttendeeValidationResponse;
      if (!result.success || !validationData.isValid) throw new Error(validationData.error || 'Name validation failed');
      if (validationData.hasAlreadyRedeemed) throw new Error('You have already redeemed a code.');
      setExpectedEmail(validationData.expectedEmail || null);
      setCurrentStep('email');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const validateEmailStep = async () => {
    if (!email.trim()) { setError('Please enter your email address'); return; }
    if (expectedEmail && email.toLowerCase().trim() !== expectedEmail.toLowerCase()) {
      setError('Email does not match the expected address.'); return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/credits/api/attendees/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'email', name: name.trim(), email: email.toLowerCase().trim(), projectId, eventId: projectId ? undefined : 'sample-event-1' }),
      });
      const result = await response.json();
      const validationData = result.data as AttendeeValidationResponse;
      if (!result.success || !validationData.isValid) throw new Error(validationData.error || 'Email validation failed');
      if (validationData.hasAlreadyRedeemed) throw new Error('You have already redeemed a code.');
      setCurrentStep('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRedemption = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/credits/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.toLowerCase().trim(), projectId, eventId: projectId ? undefined : 'sample-event-1' }),
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

  return (
    <div className="p-6" style={{ border: '3px solid #3dffa3', background: '#111', boxShadow: '4px 4px 0 rgba(61, 255, 163, 0.15)' }}>
      <h3 className="text-sm mb-1" style={{ color: '#3dffa3', fontFamily: "'Press Start 2P', monospace", lineHeight: '1.6' }}>
        ATTENDEE INFO
      </h3>
      <p className="mb-6" style={{ color: '#888', fontFamily: "'VT323', monospace", fontSize: '1.1rem' }}>
        {currentStep === 'name' && 'Step 1: Enter your name'}
        {currentStep === 'email' && 'Step 2: Confirm your email'}
        {currentStep === 'ready' && 'Ready to claim your code'}
      </p>

      <div className="space-y-6">
        {/* Step 1: Name */}
        <div className="space-y-3">
          <AttendeeAutocomplete
            value={name}
            onChange={setName}
            onAttendeeSelect={handleAttendeeSelect}
            error={currentStep === 'name' ? error : undefined}
            disabled={currentStep !== 'name' || isLoading}
            projectId={projectId}
          />
          {currentStep === 'name' && (
            <button
              onClick={validateNameStep}
              disabled={!selectedAttendee || isLoading}
              className="w-full py-3 px-6 transition-all hover:opacity-85 disabled:opacity-50"
              style={btnStyle}
            >
              {isLoading ? 'VALIDATING...' : 'CONTINUE'}
            </button>
          )}
        </div>

        {/* Step 2: Email */}
        {(currentStep === 'email' || currentStep === 'ready') && (
          <div className="space-y-3">
            <label className="block text-xs mb-1" style={{ color: '#3dffa3', fontFamily: "'Press Start 2P', monospace" }}>
              EMAIL
            </label>
            {expectedEmail && (
              <p style={{ color: '#888', fontFamily: "'VT323', monospace", fontSize: '1.05rem' }}>
                Match: <span style={{ color: '#f1c40f', fontFamily: "'VT323', monospace" }}>{maskEmail(expectedEmail)}</span>
              </p>
            )}
            <input
              type="email"
              autoComplete="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={currentStep === 'ready' || isLoading}
              style={inputStyle}
            />
            <div className="flex space-x-2">
              <button onClick={resetToNameStep} disabled={isLoading} className="flex-1 py-3 px-4 hover:opacity-85 disabled:opacity-50" style={btnOutlineStyle}>
                BACK
              </button>
              {currentStep === 'email' && (
                <button onClick={validateEmailStep} disabled={!email.trim() || isLoading} className="flex-1 py-3 px-4 hover:opacity-85 disabled:opacity-50" style={btnStyle}>
                  {isLoading ? 'VALIDATING...' : 'VERIFY'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Redeem */}
        {currentStep === 'ready' && (
          <div className="space-y-4">
            <div className="p-3" style={{ background: 'rgba(61, 255, 163, 0.1)', border: '2px solid #3dffa3' }}>
              <p style={{ color: '#3dffa3', fontFamily: "'VT323', monospace", fontSize: '1.1rem' }}>
                Name and email verified. Ready to claim your Cursor code!
              </p>
            </div>
            <button onClick={handleRedemption} disabled={isLoading} className="w-full py-4 px-6 hover:opacity-85 disabled:opacity-50" style={btnStyle}>
              {isLoading ? 'CLAIMING CODE...' : 'CLAIM MY CURSOR CODE'}
            </button>
          </div>
        )}

        {/* Error */}
        {error && currentStep !== 'name' && (
          <div className="p-3" style={{ background: 'rgba(255, 68, 68, 0.1)', border: '2px solid #ff4444' }}>
            <p style={{ color: '#ff4444', fontFamily: "'VT323', monospace", fontSize: '1.1rem' }}>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
