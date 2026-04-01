/**
 * Code redemption page
 */

import { RedemptionForm } from '@/features/attendees/components/RedemptionForm';

export default function RedeemPage() {
  return (
    <div className="min-h-screen" style={{ background: '#0b0b0b' }}>
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-xl mb-3" style={{ color: '#3dffa3', lineHeight: '1.6' }}>
              CLAIM YOUR CODE
            </h1>
            <p style={{ color: '#d3d3d3', fontFamily: "'VT323', monospace", fontSize: '1.2rem' }}>
              Enter your details to receive your Cursor credits
            </p>
          </div>
          <RedemptionForm />
        </div>
      </div>
    </div>
  );
}
