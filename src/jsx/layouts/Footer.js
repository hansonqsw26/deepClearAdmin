 import React from "react";
import { useTranslation } from "react-i18next";

const Footer = () => {
  const { t } = useTranslation();
  var d = new Date();
  return (
    <div className="footer">
      <div className="copyright">
        <p>
          {t("nav.footer")}{" "}
          <a target="_blank" rel="noreferrer">
            DeepClear
          </a>{" "}
          {d.getFullYear()}
        </p>
      </div>
    </div>
  );
};

export default Footer;
