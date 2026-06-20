import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// JazzCash redirects the customer's browser here after payment finishes
// (our backend already verified the secure hash and updated the order — this
// page just reads the status off the query string and hands off to /cards).
const CardPaymentResult: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const paymentStatus = params.get('status') || 'error';
        const orderId = params.get('orderId') || undefined;
        const reason = params.get('reason') || undefined;
        navigate('/cards', { replace: true, state: { paymentStatus, orderId, reason } });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
            <div className="spinner" />
            <p style={{ color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono', fontSize: '0.85rem' }}>Confirming your payment...</p>
        </div>
    );
};

export default CardPaymentResult;