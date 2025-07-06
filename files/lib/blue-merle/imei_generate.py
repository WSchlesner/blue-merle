#!/usr/bin/env python3
import random
import string
import argparse
import serial
import re
import json
import os
from functools import reduce
from enum import Enum


class Modes(Enum):
    DETERMINISTIC = 1
    RANDOM = 2
    STATIC = 3


ap = argparse.ArgumentParser()
ap.add_argument("-v", "--verbose", help="Enables verbose output",
                action="store_true")
ap.add_argument("-g", "--generate-only", help="Only generates an IMEI rather than setting it",
                   action="store_true")
modes = ap.add_mutually_exclusive_group()
modes.add_argument("-d", "--deterministic", help="Switches IMEI generation to deterministic mode", action="store_true")
modes.add_argument("-s", "--static", help="Sets user-defined IMEI",
                   action="store")
modes.add_argument("-r", "--random", help="Sets random IMEI",
                   action="store_true")

# TAC selection arguments
ap.add_argument("--tac-mode", help="TAC selection mode: random_any, random_category, specific", 
                choices=['random_any', 'random_category', 'specific'], default='random_any')
ap.add_argument("--tac-category", help="TAC category for random_category or specific mode")
ap.add_argument("--tac-value", help="Specific TAC value for specific mode")

# Example IMEI: 490154203237518
imei_length = 14  # without validation digit

# Default TACs (fallback if database is not available)
default_imei_prefix = ["35674108", "35290611", "35397710", "35323210", "35384110",
                      "35982748", "35672011", "35759049", "35266891", "35407115",
                      "35538025", "35480910", "35324590", "35901183", "35139729",
                      "35479164"]

verbose = False
mode = None

# Serial global vars
TTY = '/dev/ttyUSB3'
BAUDRATE = 9600
TIMEOUT = 3


def load_tac_database():
    """Load TAC database from JSON file"""
    tac_db_path = '/lib/blue-merle/tac_database.json'
    try:
        if os.path.exists(tac_db_path):
            with open(tac_db_path, 'r') as f:
                return json.load(f)
        else:
            if verbose:
                print(f"TAC database not found at {tac_db_path}, using defaults")
            return None
    except Exception as e:
        if verbose:
            print(f"Error loading TAC database: {e}, using defaults")
        return None


def get_tac_prefix(tac_mode='random_any', tac_category=None, tac_value=None):
    """Get TAC prefix based on selection mode"""
    tac_db = load_tac_database()
    
    if not tac_db:
        # Fallback to default TACs
        if verbose:
            print("Using default TAC list")
        return random.choice(default_imei_prefix)
    
    if tac_mode == 'specific' and tac_value:
        # Validate that the specific TAC exists in database
        for category_data in tac_db['categories'].values():
            if tac_value in category_data['tacs']:
                if verbose:
                    print(f"Using specific TAC: {tac_value}")
                return tac_value
        
        # If specific TAC not found, fall back to random
        if verbose:
            print(f"Specific TAC {tac_value} not found, falling back to random")
        tac_mode = 'random_any'
    
    if tac_mode == 'random_category' and tac_category:
        # Get random TAC from specific category
        if tac_category in tac_db['categories']:
            tacs = tac_db['categories'][tac_category]['tacs']
            selected_tac = random.choice(tacs)
            if verbose:
                print(f"Using random TAC from {tac_category}: {selected_tac}")
            return selected_tac
        else:
            if verbose:
                print(f"Category {tac_category} not found, falling back to random any")
            tac_mode = 'random_any'
    
    # Default: random from any category
    all_tacs = []
    for category_data in tac_db['categories'].values():
        all_tacs.extend(category_data['tacs'])
    
    selected_tac = random.choice(all_tacs)
    if verbose:
        print(f"Using random TAC from any category: {selected_tac}")
    return selected_tac


def get_imsi():
    if (verbose):
        print(f'Obtaining Serial {TTY} with timeout {TIMEOUT}...')
    with serial.Serial(TTY, BAUDRATE, timeout=TIMEOUT, exclusive=True) as ser:
        if (verbose):
            print('Getting IMSI')
        ser.write(b'AT+CIMI\r')
        # TODO: read loop until we have 'enough' of what to expect
        output = ser.read(64)

    if (verbose):
        print(b'Output of AT+CIMI (Retrieve IMSI) command: ' + output)
        print('Output is of type: ' + str(type(output)))
    imsi_d = re.findall(b'[0-9]{15}', output)
    if (verbose):
        print("TEST: Read IMSI is", imsi_d)

    return b"".join(imsi_d)


def set_imei(imei):
    with serial.Serial(TTY, BAUDRATE, timeout=TIMEOUT, exclusive=True) as ser:
        cmd = b'AT+EGMR=1,7,\"'+imei.encode()+b'\"\r'
        ser.write(cmd)
        output = ser.read(64)

    if (verbose):
        print(cmd)
        print(b'Output of AT+EGMR (Set IMEI) command: ' + output)
        print('Output is of type: ' + str(type(output)))

    new_imei = get_imei()
    if (verbose):
        print(b"New IMEI: "+new_imei+b" Old IMEI: "+imei.encode())

    if new_imei == imei.encode():
        print("IMEI has been successfully changed.")
        return True
    else:
        print("IMEI has not been successfully changed.")
        return False


def get_imei():
    with serial.Serial(TTY, BAUDRATE, timeout=TIMEOUT, exclusive=True) as ser:
        ser.write(b'AT+GSN\r')
        output = ser.read(64)

    if (verbose):
        print(b'Output of AT+GSN (Retrieve IMEI) command: ' + output)
        print('Output is of type: ' + str(type(output)))
    imei_d = re.findall(b'[0-9]{15}', output)
    if (verbose):
        print("TEST: Read IMEI is", imei_d)

    return b"".join(imei_d)


def generate_imei(imei_prefix, imsi_d, tac_mode='random_any', tac_category=None, tac_value=None):
    # In deterministic mode we seed the RNG with the IMSI.
    # As a consequence we will always generate the same IMEI for a given IMSI
    if (mode == Modes.DETERMINISTIC):
        random.seed(imsi_d)

    # Get TAC prefix based on selection mode
    if isinstance(imei_prefix, list):
        # Legacy mode - use provided list
        imei = random.choice(imei_prefix)
    else:
        # New TAC selection mode
        imei = get_tac_prefix(tac_mode, tac_category, tac_value)
    
    if (verbose):
        print(f"IMEI prefix (TAC): {imei}")
    
    random_part_length = imei_length - len(imei)
    if (verbose):
        print(f"Length of the random IMEI part: {random_part_length}")
    imei += "".join(random.sample(string.digits, random_part_length))
    if (verbose):
        print(f"IMEI without validation digit: {imei}")

    # calculate validation digit
    # Double each second digit in the IMEI: 4 18 0 2 5 8 2 0 3 4 3 14 5 2
    # (excluding the validation digit)

    iteration_1 = "".join([c if i % 2 == 0 else str(2*int(c)) for i, c in enumerate(imei)])

    # Separate this number into single digits: 4 1 8 0 2 5 8 2 0 3 4 3 1 4 5 2
    # (notice that 18 and 14 have been split).
    # Add up all the numbers: 4+1+8+0+2+5+8+2+0+3+4+3+1+4+5+2 = 52

    sum = reduce((lambda a, b: int(a) + int(b)), iteration_1)

    # Take your resulting number, remember it, and round it up to the nearest
    # multiple of ten: 60.
    # Subtract your original number from the rounded-up number: 60 - 52 = 8.

    validation_digit = (10 - int(str(sum)[-1])) % 10
    if (verbose):
        print(f"Validation digit: {validation_digit}")

    imei = str(imei) + str(validation_digit)
    if (verbose):
        print(f"Resulting IMEI: {imei}")

    return imei


def validate_imei(imei):
    # before anything check if length is 14 characters
    if len(imei) != 15:
        print(f"NOT A VALID IMEI: {imei} - IMEI must be 15 characters in length")
        return False
    # cut off last digit
    validation_digit = int(imei[-1])
    imei_verify = imei[0:14]
    if (verbose):
        print(imei_verify)

    # Double each second digit in the IMEI
    iteration_1 = "".join([c if i % 2 == 0 else str(2*int(c)) for i, c in enumerate(imei_verify)])

    # Separate this number into single digits and add them up
    sum = reduce((lambda a, b: int(a) + int(b)), iteration_1)
    if (verbose):
        print(sum)

    # Take your resulting number, remember it, and round it up to the nearest
    # multiple of ten.
    # Subtract your original number from the rounded-up number.
    validation_digit_verify = (10 - int(str(sum)[-1])) % 10
    if (verbose):
        print(validation_digit_verify)

    if validation_digit == validation_digit_verify:
        print(f"{imei} is CORRECT")
        return True

    print(f"NOT A VALID IMEI: {imei}")
    return False


if __name__ == '__main__':
    args = ap.parse_args()
    imsi_d = None
    if args.verbose:
        verbose = args.verbose
    if args.deterministic:
        mode = Modes.DETERMINISTIC
        imsi_d = get_imsi()
    if args.random:
        mode = Modes.RANDOM
    if args.static is not None:
        mode = Modes.STATIC
        static_imei = args.static

    if mode == Modes.STATIC:
        if validate_imei(static_imei):
            set_imei(static_imei)
        else:
            exit(-1)
    else:
        imei = generate_imei(default_imei_prefix, imsi_d, args.tac_mode, args.tac_category, args.tac_value)
        if (verbose):
            print(f"Generated new IMEI: {imei}")
        if not args.generate_only:
            if not set_imei(imei):
                exit(-1)

    exit(0)