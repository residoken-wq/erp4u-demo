import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, Tooltip, Tag } from 'antd';
import { UserOutlined, ClockCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

interface LeadKanbanBoardProps {
  leads: any[];
  statusLabels: any;
  statusColors: any;
  onEditLead: (lead: any) => void;
  onFollowLead: (lead: any) => void;
}

const statusColumns = ['NEW', 'CONTACTED', 'QUALIFIED', 'NEGOTIATION', 'WON', 'LOST'];

export const LeadKanbanBoard: React.FC<LeadKanbanBoardProps> = ({
  leads, statusLabels, statusColors, onEditLead, onFollowLead
}) => {
  return (
    <div className="flex gap-4 overflow-x-auto pb-6 pt-2 snap-x" style={{ scrollSnapType: 'x mandatory' }}>
      {statusColumns.map((status) => {
        const columnLeads = leads.filter(l => (l.lead_status || 'NEW') === status);
        return (
          <div key={status} className="flex-shrink-0 w-80 glass-panel flex flex-col snap-center" style={{ height: '70vh' }}>
            {/* Header */}
            <div className="p-4 border-b border-white/20 flex justify-between items-center bg-white/40 rounded-t-xl">
              <h3 className="font-heading font-semibold text-lg text-[#1f2937] m-0">
                {statusLabels[status]}
              </h3>
              <Tag color={statusColors[status]}>{columnLeads.length}</Tag>
            </div>
            
            {/* Cards */}
            <div className="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
              <AnimatePresence>
                {columnLeads.map((lead) => (
                  <motion.div
                    key={lead.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    whileHover={{ scale: 1.02, y: -4 }}
                    className="bg-white/80 backdrop-blur-sm border border-white/40 rounded-lg p-4 shadow-sm hover:shadow-lg cursor-pointer transition-shadow"
                    onClick={() => onEditLead(lead)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                         <Avatar className="bg-blue-500" size="small" icon={<UserOutlined />} />
                         <span className="font-semibold text-gray-800 truncate" style={{ maxWidth: '150px' }}>
                             {lead.customer?.name || lead.name}
                         </span>
                      </div>
                      <span className="text-xs text-gray-500">{dayjs(lead.created_at).format('DD/MM')}</span>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-3 truncate">
                      {lead.customer?.phone || lead.phone}
                    </div>

                    <div className="flex justify-between items-center mt-2">
                       <span className="font-semibold text-orange-500 text-sm">
                         {Number(lead.potential_value) > 0 ? Number(lead.potential_value).toLocaleString() + 'đ' : '-'}
                       </span>
                       <Tooltip title="Chăm sóc">
                         <motion.button 
                           whileHover={{ scale: 1.1 }}
                           whileTap={{ scale: 0.9 }}
                           onClick={(e) => { e.stopPropagation(); onFollowLead(lead); }}
                           className="p-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border-none cursor-pointer flex items-center justify-center"
                         >
                           <ClockCircleOutlined />
                         </motion.button>
                       </Tooltip>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {columnLeads.length === 0 && (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                  Không có dữ liệu
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
