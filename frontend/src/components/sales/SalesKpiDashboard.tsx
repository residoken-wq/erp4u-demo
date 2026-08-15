import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { DollarOutlined, WalletOutlined, AuditOutlined, ShoppingCartOutlined, FileTextOutlined } from '@ant-design/icons';
import clsx from 'clsx';
import gsap from 'gsap';

interface SalesKpiDashboardProps {
  metrics: {
    totalRevenue: number;
    totalPaid: number;
    totalRemaining: number;
    count: number;
    processingCount: number;
  };
  isMobile: boolean;
}

const NumberCounter = ({ value, suffix = "" }: { value: number, suffix?: string }) => {
  const nodeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (node) {
      gsap.to(node, {
        innerHTML: value,
        duration: 1.5,
        snap: { innerHTML: 1 },
        ease: "power2.out",
        onUpdate: function() {
          const val = Number(node.innerHTML);
          node.innerHTML = val.toLocaleString() + (suffix ? suffix : "");
        }
      });
    }
  }, [value, suffix]);

  return <span ref={nodeRef} className="text-xl md:text-2xl tracking-tight font-medium">0</span>;
};

export const SalesKpiDashboard: React.FC<SalesKpiDashboardProps> = ({ metrics, isMobile }) => {
  const cards = [
    {
      title: "Tổng GT",
      value: metrics.totalRevenue,
      prefixIcon: <DollarOutlined />,
      suffix: "₫",
      colorClass: "glass-panel from-blue-50/50 to-white/50 text-blue-600 border-blue-200/50"
    },
    {
      title: "Thực Thu",
      value: metrics.totalPaid,
      prefixIcon: <WalletOutlined />,
      suffix: "₫",
      colorClass: "glass-panel from-green-50/50 to-white/50 text-green-600 border-green-200/50"
    },
    {
      title: "Công Nợ",
      value: metrics.totalRemaining,
      prefixIcon: <AuditOutlined />,
      suffix: "₫",
      colorClass: "glass-panel from-orange-50/50 to-white/50 text-orange-600 border-orange-200/50"
    },
    ...(!isMobile ? [
      {
        title: "Số Đơn",
        value: metrics.count,
        prefixIcon: <ShoppingCartOutlined />,
        suffix: "",
        colorClass: "glass-panel from-indigo-50/50 to-white/50 text-indigo-600 border-indigo-200/50"
      },
      {
        title: "Đang XL",
        value: metrics.processingCount,
        prefixIcon: <FileTextOutlined />,
        suffix: "",
        colorClass: "glass-panel from-yellow-50/50 to-white/50 text-yellow-600 border-yellow-200/50"
      }
    ] : [])
  ];

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 pt-2 px-2 snap-x custom-scrollbar">
      {cards.map((card, index) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1, type: "spring", stiffness: 200, damping: 20 }}
          whileHover={{ y: -5, scale: 1.02 }}
          className={clsx(
            "flex-shrink-0 snap-center min-w-[140px] md:min-w-[180px] p-4 bg-gradient-to-br hover:shadow-lg transition-all cursor-default",
            card.colorClass
          )}
        >
          <div className="flex items-center gap-2 mb-2 opacity-80">
            <span className="text-lg">{card.prefixIcon}</span>
            <span className="font-heading font-medium text-sm md:text-base">{card.title}</span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
             <NumberCounter value={card.value} suffix={card.suffix} />
          </div>
        </motion.div>
      ))}
    </div>
  );
};
