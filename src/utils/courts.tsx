import React, { useState, useEffect } from 'react';

export const COURT_OPTIONS = [
  'محكمة القاهرة الجديدة',
  'محكمة الخانكة',
  'محكمة أسرة الخانكة',
  'محكمة شمال القاهرة',
  'مجمع محاكم مجلس الدولة بالرحاب'
];

interface CourtSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export const CourtSelect: React.FC<CourtSelectProps> = ({
  value,
  onChange,
  placeholder = "أدخل اسم المحكمة يدوياً",
  required = false,
  className = "w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all text-right font-semibold"
}) => {
  const isPredefined = COURT_OPTIONS.includes(value) || value === '';

  const [selectedOption, setSelectedOption] = useState<string>(() => {
    if (value === '') return '';
    return isPredefined ? value : 'manual';
  });

  const [manualValue, setManualValue] = useState<string>(() => {
    return isPredefined ? '' : value;
  });

  useEffect(() => {
    const internalPredefined = COURT_OPTIONS.includes(value) || value === '';
    if (value === '') {
      setSelectedOption('');
      setManualValue('');
    } else if (internalPredefined) {
      setSelectedOption(value);
      setManualValue('');
    } else {
      setSelectedOption('manual');
      setManualValue(value);
    }
  }, [value]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedOption(val);
    if (val === 'manual') {
      onChange(manualValue);
    } else {
      onChange(val);
    }
  };

  const handleManualValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setManualValue(val);
    onChange(val);
  };

  return (
    <div className="w-full text-right" dir="rtl">
      <select
        value={selectedOption}
        onChange={handleSelectChange}
        required={required}
        className={`${className} cursor-pointer`}
      >
        <option value="">اختر المحكمة...</option>
        {COURT_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        <option value="manual" className="text-amber-600 font-bold">تحديد المحكمة يدويًا</option>
      </select>

      {selectedOption === 'manual' && (
        <input
          type="text"
          placeholder={placeholder}
          value={manualValue}
          onChange={handleManualValueChange}
          required={required}
          className={`${className} mt-2 border-amber-300 focus:ring-amber-500/20`}
        />
      )}
    </div>
  );
};
