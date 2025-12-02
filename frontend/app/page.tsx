"use client"

import NotConnected from "@/components/shared/NotConnected";

import {useAccount} from "wagmi";

export default function Home() {

    const {isConnected} = useAccount();

    return (
        <>
            {isConnected ? (
                <h1>Hello World</h1>
            ) : (
                <NotConnected/>
            )}
        </>
    );
}
