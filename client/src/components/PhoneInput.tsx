import { useState, useRef, useEffect } from 'react';

interface Country {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
}

const countries: Country[] = [
  { code: 'RO', name: 'Romania', dialCode: '+40', flag: '🇷🇴' },
  { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧' },
  { code: 'DE', name: 'Germany', dialCode: '+49', flag: '🇩🇪' },
  { code: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷' },
  { code: 'IT', name: 'Italy', dialCode: '+39', flag: '🇮🇹' },
  { code: 'ES', name: 'Spain', dialCode: '+34', flag: '🇪🇸' },
  { code: 'NL', name: 'Netherlands', dialCode: '+31', flag: '🇳🇱' },
  { code: 'BE', name: 'Belgium', dialCode: '+32', flag: '🇧🇪' },
  { code: 'AT', name: 'Austria', dialCode: '+43', flag: '🇦🇹' },
  { code: 'CH', name: 'Switzerland', dialCode: '+41', flag: '🇨🇭' },
  { code: 'PL', name: 'Poland', dialCode: '+48', flag: '🇵🇱' },
  { code: 'CZ', name: 'Czech Republic', dialCode: '+420', flag: '🇨🇿' },
  { code: 'HU', name: 'Hungary', dialCode: '+36', flag: '🇭🇺' },
  { code: 'GR', name: 'Greece', dialCode: '+30', flag: '🇬🇷' },
  { code: 'PT', name: 'Portugal', dialCode: '+351', flag: '🇵🇹' },
  { code: 'SE', name: 'Sweden', dialCode: '+46', flag: '🇸🇪' },
  { code: 'NO', name: 'Norway', dialCode: '+47', flag: '🇳🇴' },
  { code: 'DK', name: 'Denmark', dialCode: '+45', flag: '🇩🇰' },
  { code: 'FI', name: 'Finland', dialCode: '+358', flag: '🇫🇮' },
  { code: 'IE', name: 'Ireland', dialCode: '+353', flag: '🇮🇪' },
  { code: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺' },
  { code: 'NZ', name: 'New Zealand', dialCode: '+64', flag: '🇳🇿' },
  { code: 'JP', name: 'Japan', dialCode: '+81', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', dialCode: '+82', flag: '🇰🇷' },
  { code: 'CN', name: 'China', dialCode: '+86', flag: '🇨🇳' },
  { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳' },
  { code: 'BR', name: 'Brazil', dialCode: '+55', flag: '🇧🇷' },
  { code: 'MX', name: 'Mexico', dialCode: '+52', flag: '🇲🇽' },
  { code: 'AR', name: 'Argentina', dialCode: '+54', flag: '🇦🇷' },
  { code: 'ZA', name: 'South Africa', dialCode: '+27', flag: '🇿🇦' },
  { code: 'EG', name: 'Egypt', dialCode: '+20', flag: '🇪🇬' },
  { code: 'TR', name: 'Turkey', dialCode: '+90', flag: '🇹🇷' },
  { code: 'IL', name: 'Israel', dialCode: '+972', flag: '🇮🇱' },
  { code: 'AE', name: 'United Arab Emirates', dialCode: '+971', flag: '🇦🇪' },
  { code: 'SA', name: 'Saudi Arabia', dialCode: '+966', flag: '🇸🇦' },
  { code: 'SG', name: 'Singapore', dialCode: '+65', flag: '🇸🇬' },
  { code: 'MY', name: 'Malaysia', dialCode: '+60', flag: '🇲🇾' },
  { code: 'TH', name: 'Thailand', dialCode: '+66', flag: '🇹🇭' },
  { code: 'PH', name: 'Philippines', dialCode: '+63', flag: '🇵🇭' },
  { code: 'ID', name: 'Indonesia', dialCode: '+62', flag: '🇮🇩' },
  { code: 'VN', name: 'Vietnam', dialCode: '+84', flag: '🇻🇳' },
  { code: 'RU', name: 'Russia', dialCode: '+7', flag: '🇷🇺' },
  { code: 'UA', name: 'Ukraine', dialCode: '+380', flag: '🇺🇦' },
];

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
}

export default function PhoneInput({
  value,
  onChange,
  placeholder = '712 345 678',
  className = '',
  required = false,
  disabled = false,
}: PhoneInputProps) {
  const [selectedCountry, setSelectedCountry] = useState<Country>(countries[0]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Parse initial value
  useEffect(() => {
    if (value) {
      // Find matching country by dial code
      const matchedCountry = countries.find(c => value.startsWith(c.dialCode));
      if (matchedCountry) {
        setSelectedCountry(matchedCountry);
        setPhoneNumber(value.substring(matchedCountry.dialCode.length));
      } else {
        setPhoneNumber(value);
      }
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setSearchQuery('');
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);

  // Update parent component with full phone number
  useEffect(() => {
    const fullNumber = selectedCountry.dialCode + phoneNumber.replace(/\s/g, '');
    onChange(fullNumber);
  }, [selectedCountry, phoneNumber, onChange]);

  function handlePhoneNumberChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Allow only digits and spaces
    const value = e.target.value.replace(/[^\d\s]/g, '');
    setPhoneNumber(value);
  }

  function selectCountry(country: Country) {
    setSelectedCountry(country);
    setIsDropdownOpen(false);
    setSearchQuery('');
  }

  const filteredCountries = searchQuery
    ? countries.filter(
        c =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.dialCode.includes(searchQuery) ||
          c.code.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : countries;

  return (
    <div className={`relative ${className}`}>
      <div className="flex">
        {/* Country Selector */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => !disabled && setIsDropdownOpen(!isDropdownOpen)}
            disabled={disabled}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-700 border border-r-0 border-slate-300 dark:border-slate-600 rounded-l-md hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-2xl">{selectedCountry.flag}</span>
            <span className="text-sm font-medium text-slate-900 dark:text-white">
              {selectedCountry.dialCode}
            </span>
            <svg
              className={`w-4 h-4 text-slate-500 dark:text-slate-400 transition-transform ${
                isDropdownOpen ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown */}
          {isDropdownOpen && (
            <div className="absolute z-50 mt-1 w-80 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-96 overflow-hidden">
              {/* Search */}
              <div className="p-2 border-b border-slate-200 dark:border-slate-700">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search country..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              {/* Country List */}
              <div className="overflow-y-auto max-h-80">
                {filteredCountries.length > 0 ? (
                  filteredCountries.map((country) => (
                    <button
                      key={country.code}
                      type="button"
                      onClick={() => selectCountry(country)}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${
                        selectedCountry.code === country.code
                          ? 'bg-blue-50 dark:bg-blue-900/20'
                          : ''
                      }`}
                    >
                      <span className="text-2xl">{country.flag}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {country.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {country.code}
                        </div>
                      </div>
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        {country.dialCode}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    No countries found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Phone Number Input */}
        <input
          type="tel"
          value={phoneNumber}
          onChange={handlePhoneNumberChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className="flex-1 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-r-md text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}
