import React, { useMemo, useState } from 'react';
import { 
  DollarSign, TrendingUp, Users, Home, AlertCircle, 
  CheckCircle2, Clock, Landmark, Percent, ChevronRight,
  Palette, Sparkles, ShieldCheck, Activity, Terminal, Check, 
  LayoutGrid, CheckSquare, Building2, PieChart, FileBarChart, 
  CreditCard, History, Folders, Library, MapPin, SlidersHorizontal,
  ArrowLeft, Bell, Settings, Receipt, Wallet
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  ReOwner, ReProperty, ReUnit, ReTenant, 
  ReCollectionReceipt, RePayout, RePropertyExpense 
} from '../../types';

interface RealEstateDashboardProps {
  owners: ReOwner[];
  properties: ReProperty[];
  units: ReUnit[];
  tenants: ReTenant[];
  collections: ReCollectionReceipt[];
  payouts: RePayout[];
  expenses: RePropertyExpense[];
  onNavigateToTab: (tabId: string) => void;
}

export default function RealEstateDashboard({
  owners,
  properties,
  units,
  tenants,
  collections,
  payouts,
  expenses,
  onNavigateToTab
}: RealEstateDashboardProps) {

  // Selected owner for filtering the dynamic property list
  const [selectedOwnerFilter, setSelectedOwnerFilter] = useState<string>('all');

  // Current Month / Year for default calculations
  const currentMonthYear = useMemo(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`; // e.g. "2026-07"
  }, []);

  // Extra computed values for 6 metrics
  const totalCollectionsAllTime = useMemo(() => collections.reduce((acc, curr) => acc + curr.amountPaid, 0), [collections]);
  const totalPayoutsAllTime = useMemo(() => payouts.filter(p => p.status === 'payout_completed').reduce((acc, curr) => acc + curr.netAmountPaid, 0), [payouts]);
  const totalExpensesAllTime = useMemo(() => expenses.reduce((acc, curr) => acc + curr.amount, 0), [expenses]);
  const treasuryBalance = useMemo(() => 250000 + totalCollectionsAllTime - totalPayoutsAllTime - totalExpensesAllTime, [totalCollectionsAllTime, totalPayoutsAllTime, totalExpensesAllTime]);
  const netRevenueThisMonth = useMemo(() => {
    const collectionsThisMonth = collections.filter(c => c.forMonthYear === currentMonthYear || c.paymentDate.startsWith(currentMonthYear));
    const totalCollectedThisMonth = collectionsThisMonth.reduce((acc, curr) => acc + curr.amountPaid, 0);
    const expensesThisMonth = expenses.filter(e => e.expenseDate.startsWith(currentMonthYear));
    const totalExpensesThisMonth = expensesThisMonth.reduce((acc, curr) => acc + curr.amount, 0);
    return totalCollectedThisMonth - totalExpensesThisMonth;
  }, [collections, expenses, currentMonthYear]);

  // Real-time calculation of stats
  const stats = useMemo(() => {
    // 1. Total active units & expected rent per month
    const activeRentedUnits = units.filter(u => u.status === 'rented');
    const totalExpectedMonthlyRent = activeRentedUnits.reduce((acc, curr) => acc + curr.rentValue, 0);

    // 2. Collections in current month
    const collectionsThisMonth = collections.filter(c => c.forMonthYear === currentMonthYear || c.paymentDate.startsWith(currentMonthYear));
    const totalCollectedThisMonth = collectionsThisMonth.reduce((acc, curr) => acc + curr.amountPaid, 0);

    // 3. Remaining Rent this month
    const totalRemainingThisMonth = Math.max(0, totalExpectedMonthlyRent - totalCollectedThisMonth);

    // 4. Commissions calculated dynamically based on owner rules for collected rent
    let totalCommissionsThisMonth = 0;
    collectionsThisMonth.forEach(c => {
      // Find unit -> property -> owner to get commission structure
      const unit = units.find(u => u.id === c.unitId);
      if (unit) {
        const property = properties.find(p => p.id === unit.propertyId);
        if (property) {
          const owner = owners.find(o => o.id === property.ownerId);
          if (owner) {
            if (owner.commissionType === 'percentage') {
              totalCommissionsThisMonth += (c.amountPaid * (owner.commissionValue / 100));
            } else if (owner.commissionType === 'fixed_per_thousand') {
              totalCommissionsThisMonth += (c.amountPaid * (owner.commissionValue / 1000));
            } else { // fixed_flat per collection
              totalCommissionsThisMonth += owner.commissionValue;
            }
          }
        }
      }
    });

    // 5. Arrears / Late tenants count (units with due dates passed and no collection logged this month)
    const currentDay = new Date().getDate();
    let lateTenantsCount = 0;
    const lateTenantsList: { tenantName: string; unitNum: string; propName: string; amount: number; delayDays: number }[] = [];

    activeRentedUnits.forEach(u => {
      const tenant = tenants.find(t => t.unitId === u.id);
      if (tenant) {
        // Check if there is a collection for this unit this month
        const collected = collectionsThisMonth.some(c => c.unitId === u.id);
        if (!collected && currentDay > u.dueDay) {
          lateTenantsCount++;
          const delayDays = currentDay - u.dueDay;
          const prop = properties.find(p => p.id === u.propertyId);
          lateTenantsList.push({
            tenantName: tenant.fullName,
            unitNum: u.unitNumber,
            propName: prop?.name || 'عقار غير معروف',
            amount: u.rentValue,
            delayDays
          });
        }
      }
    });

    return {
      expectedRent: totalExpectedMonthlyRent,
      collected: totalCollectedThisMonth,
      remaining: totalRemainingThisMonth,
      commissions: totalCommissionsThisMonth,
      propertiesCount: properties.length,
      unitsCount: units.length,
      vacantCount: units.filter(u => u.status === 'vacant').length,
      rentedCount: activeRentedUnits.length,
      maintenanceCount: units.filter(u => u.status === 'maintenance').length,
      lateCount: lateTenantsCount,
      lateList: lateTenantsList
    };
  }, [owners, properties, units, tenants, collections, currentMonthYear]);

  // Dynamic calculations for the monthly performance chart
  const chartData = useMemo(() => {
    // Let's generate stats for the last 6 months
    const months = [];
    const d = new Date();
    for (let i = 5; i >= 0; i--) {
      const tempDate = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const mm = String(tempDate.getMonth() + 1).padStart(2, '0');
      months.push({
        label: tempDate.toLocaleDateString('ar-EG', { month: 'short' }),
        key: `${tempDate.getFullYear()}-${mm}`,
      });
    }

    return months.map(m => {
      const colMonth = collections.filter(c => c.forMonthYear === m.key || c.paymentDate.startsWith(m.key));
      const colSum = colMonth.reduce((acc, curr) => acc + curr.amountPaid, 0);
      
      // Calculate commission for that month
      let commSum = 0;
      colMonth.forEach(c => {
        const unit = units.find(u => u.id === c.unitId);
        if (unit) {
          const property = properties.find(p => p.id === unit.propertyId);
          if (property) {
            const owner = owners.find(o => o.id === property.ownerId);
            if (owner) {
              if (owner.commissionType === 'percentage') {
                commSum += (c.amountPaid * (owner.commissionValue / 100));
              } else if (owner.commissionType === 'fixed_per_thousand') {
                commSum += (c.amountPaid * (owner.commissionValue / 1000));
              } else {
                commSum += owner.commissionValue;
              }
            }
          }
        }
      });

      return {
        monthName: m.label,
        collected: colSum,
        commission: commSum,
      };
    });
  }, [collections, owners, properties, units]);

  // Max value in chart for scaling
  const maxChartValue = useMemo(() => {
    const vals = chartData.map(d => d.collected);
    const maxVal = Math.max(...vals, 10000);
    return Math.ceil(maxVal / 5000) * 5000;
  }, [chartData]);

  // Contract Expirations (Contracts expiring in next 60 days)
  const expiringContracts = useMemo(() => {
    const today = new Date();
    const limit = new Date();
    limit.setDate(today.getDate() + 60);

    return tenants.filter(t => {
      if (t.status !== 'active') return false;
      const expDate = new Date(t.contractEndDate);
      return expDate >= today && expDate <= limit;
    }).map(t => {
      const unit = units.find(u => u.id === t.unitId);
      const prop = unit ? properties.find(p => p.id === unit.propertyId) : null;
      const daysLeft = Math.ceil((new Date(t.contractEndDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: t.id,
        tenantName: t.fullName,
        unitNumber: unit?.unitNumber || '',
        propName: prop?.name || 'عقار غير معروف',
        endDate: t.contractEndDate,
        daysLeft
      };
    });
  }, [tenants, units, properties]);

  // Filter properties according to chosen owner
  const filteredProperties = useMemo(() => {
    if (selectedOwnerFilter === 'all') return properties;
    return properties.filter(p => p.ownerId === selectedOwnerFilter);
  }, [properties, selectedOwnerFilter]);

  // Calculate detailed stats per property card
  const getPropertyStats = (propertyId: string) => {
    const propUnits = units.filter(u => u.propertyId === propertyId);
    const rentedUnits = propUnits.filter(u => u.status === 'rented');
    return {
      totalUnits: propUnits.length,
      rentedCount: rentedUnits.length,
      floors: propUnits.length > 0 ? Math.max(...propUnits.map(u => u.floor), 1) : 1
    };
  };

  return (
    <div className="space-y-6 text-[#F8F9FB] pb-6" dir="rtl">
      
      {/* Dynamic Title / Header Block */}
      <div className="flex items-center gap-2.5">
        <div className="w-1.5 h-4.5 bg-[#D4A84F] rounded-full animate-pulse" />
        <h2 className="text-sm sm:text-base font-black text-white tracking-wide font-sans">بوابة الوصول السريع لخدمات المحفظة العقارية ⚡</h2>
      </div>

      {/* Grid of Clean Quick Access Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-5 gap-4 relative z-10">
        {[
          { id: 'owners', label: 'الملاك وأصحاب العقارات', icon: Landmark, color: 'from-[#D4A84F]/10 to-[#B38734]/5' },
          { id: 'properties', label: 'سجل العقارات والمباني', icon: Building2, color: 'from-blue-500/10 to-indigo-500/5' },
          { id: 'units', label: 'الوحدات السكنية والشواغر', icon: Home, color: 'from-emerald-500/10 to-teal-500/5' },
          { id: 'tenants', label: 'بيانات المستأجرين والعقود', icon: Users, color: 'from-purple-500/10 to-violet-500/5' },
          { id: 'collections', label: 'تسجيل وتحصيل الإيجارات', icon: Receipt, color: 'from-amber-500/10 to-yellow-500/5' },
          { id: 'expenses', label: 'مصروفات التشغيل والصيانة', icon: CreditCard, color: 'from-rose-500/10 to-pink-500/5' },
          { id: 'payouts', label: 'تسوية حسابات الملاك والعمولات', icon: Percent, color: 'from-[#D4A84F]/10 to-[#B38734]/5' },
          { id: 'reports', label: 'محرك التقارير المالية الذكية', icon: FileBarChart, color: 'from-cyan-500/10 to-sky-500/5' },
          { id: 'logs', label: 'سجل العمليات والرقابة والأمان', icon: History, color: 'from-slate-500/10 to-zinc-500/5' },
        ].map(card => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.id}
              onClick={() => onNavigateToTab(card.id)}
              whileHover={{ scale: 1.025, translateY: -2 }}
              whileTap={{ scale: 0.975 }}
              className={`bg-[#132238]/40 backdrop-blur-md border border-[#D4A84F]/15 hover:border-[#D4A84F]/40 hover:bg-[#132238]/65 rounded-2xl p-5 cursor-pointer hover:shadow-[0_8px_30px_rgb(212,168,79,0.05)] transition-all duration-300 relative group overflow-hidden flex flex-col items-center justify-center text-center gap-3.5 h-[145px]`}
            >
              {/* Decorative Subtle Glowing Background */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#D4A84F]/0 via-transparent to-[#D4A84F]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              {/* Icon Container */}
              <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-[#D4A84F]/10 border border-[#D4A84F]/15 text-[#D4A84F] group-hover:bg-[#D4A84F]/20 group-hover:text-white transition-all shrink-0">
                <Icon className="w-6 h-6 transition-transform duration-300 group-hover:scale-110" />
              </div>

              {/* Title label */}
              <div>
                <h3 className="text-xs font-black text-[#F8FAFC] group-hover:text-[#D4A84F] transition-colors line-clamp-2 max-w-[130px] leading-relaxed">
                  {card.label}
                </h3>
              </div>
            </motion.div>
          );
        })}
      </div>

    </div>
  );
}

// Minimal placeholder or custom icon component inside RealEstateDashboard file to make sure KeyIcon exists and resolves perfectly
function KeyIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 1.5 1.5M15.5 7.5 14 6" />
    </svg>
  );
}
