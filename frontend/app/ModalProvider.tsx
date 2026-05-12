'use client';

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

interface ModalState {
    open: boolean;
    type: 'alert' | 'confirm';
    message: string;
}

interface ModalContextValue {
    showAlert: (message: string) => Promise<void>;
    showConfirm: (message: string) => Promise<boolean>;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
    const [modal, setModal] = useState<ModalState>({ open: false, type: 'alert', message: '' });
    const resolveRef = useRef<((value: boolean) => void) | null>(null);

    const showAlert = useCallback((message: string): Promise<void> => {
        return new Promise((resolve) => {
            resolveRef.current = () => resolve();
            setModal({ open: true, type: 'alert', message });
        });
    }, []);

    const showConfirm = useCallback((message: string): Promise<boolean> => {
        return new Promise((resolve) => {
            resolveRef.current = resolve;
            setModal({ open: true, type: 'confirm', message });
        });
    }, []);

    const handleClose = (value: boolean) => {
        setModal(prev => ({ ...prev, open: false }));
        resolveRef.current?.(value);
        resolveRef.current = null;
    };

    return (
        <ModalContext.Provider value={{ showAlert, showConfirm }}>
            {children}
            {modal.open && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c1917]/40 backdrop-blur-[2px]"
                    onClick={(e) => { if (e.target === e.currentTarget && modal.type === 'alert') handleClose(true); }}
                >
                    <div className="bg-[#fafaf8] border border-[#d6d0c8] max-w-sm w-full mx-6">
                        {/* Header */}
                        <div className="px-8 pt-7 pb-5">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-5 h-px bg-[#d6d0c8]" />
                                <span className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#a8a29e]">
                                    {modal.type === 'confirm' ? 'Confirmation' : 'Information'}
                                </span>
                            </div>
                            <p className="text-[14px] font-light text-[#1c1917] leading-[1.75] whitespace-pre-line">
                                {modal.message}
                            </p>
                        </div>
                        {/* Footer */}
                        <div className="border-t border-[#e7e3dc] px-8 py-5 flex gap-3 justify-end">
                            {modal.type === 'confirm' && (
                                <button
                                    onClick={() => handleClose(false)}
                                    className="text-[11px] font-medium tracking-[0.08em] uppercase px-5 py-2 border border-[#d6d0c8] text-[#78716c] hover:border-[#1c1917] hover:text-[#1c1917] transition-all duration-200 cursor-pointer"
                                >
                                    Annuler
                                </button>
                            )}
                            <button
                                onClick={() => handleClose(true)}
                                className="text-[11px] font-medium tracking-[0.08em] uppercase px-5 py-2 bg-[#1c1917] text-[#fafaf8] border border-[#1c1917] hover:bg-[#292524] transition-all duration-200 cursor-pointer"
                            >
                                {modal.type === 'confirm' ? 'Confirmer' : 'OK'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ModalContext.Provider>
    );
}

export function useModal() {
    const ctx = useContext(ModalContext);
    if (!ctx) throw new Error('useModal must be used within ModalProvider');
    return ctx;
}
