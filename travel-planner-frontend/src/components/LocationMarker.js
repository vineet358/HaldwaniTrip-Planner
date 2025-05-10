import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), { ssr: false });

const LocationMarker = ({ position, name }) => {
  if (typeof window === "undefined") return null; 

  return (
    <Marker position={position}>
      <Popup>{name}</Popup>
    </Marker>
  );
};

export default LocationMarker;
