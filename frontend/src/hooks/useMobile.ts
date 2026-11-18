import { Grid } from 'antd';

const { useBreakpoint } = Grid;

const useMobile = () => {
    const screens = useBreakpoint();
    // xs is < 576px. We can treat xs as mobile. 
    // Or we can say if md is false, it's mobile/tablet.
    // Let's define "Mobile" as predominantly small screens (phones).
    // If screens object is empty (initial load), default to false (desktop) to avoid layout shift or default to true?
    // Antd useBreakpoint might return empty initially.

    // Logic: if 'md' (>= 768px) is strictly false and we have 'xs' or 'sm', it's mobile.
    // However, simplest check: !screens.md

    return (screens.xs || (screens.sm && !screens.md));
};

export default useMobile;
