import React, { useContext, useEffect } from 'react';
import { ThemeContext } from '../../context/ThemeContext';
import QuoteSummaryCards from './QuoteSummaryCards';

/** Dashboard: quote summary cards. */
const Dashboard = () => {
	const { changeBackground, changeSideBarStyle, changePrimaryColor, chnageSidebarColor } = useContext(ThemeContext);

	useEffect(() => {
		changeBackground({ value: 'light', label: 'Light' });
		if (window.innerWidth >= 768) {
			changeSideBarStyle({ value: 'full', label: 'full' });
		}
		changePrimaryColor('color_1');
		chnageSidebarColor('color_1');
		// Theme setup runs once on first load.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<div className="row invoice-card-row">
			<QuoteSummaryCards />
		</div>
	);
};

export default Dashboard;
